// Response shapes for users and scenes, used for database documents and demo
// data alike. Nothing private (email, password hash, __v) is ever copied out.
const { sniffImageType } = require("./image");

const TYPE_BY_LABEL = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  png: "image/png",
  "image/png": "image/png",
  webp: "image/webp",
  "image/webp": "image/webp",
};

const DEMO_EMAIL = /@scenic\.example$/i;

const toId = (value) => String(value && value._id ? value._id : value);

/**
 * A stored image's MIME type. Stored labels vary ("jpeg" from the seeder,
 * "image/png" from uploads); an unknown label falls back to the bytes.
 * @returns {"image/jpeg" | "image/png" | "image/webp"}
 */
function normaliseContentType(label, base64Data) {
  const known =
    TYPE_BY_LABEL[
      String(label || "")
        .trim()
        .toLowerCase()
    ];
  if (known) return known;
  if (typeof base64Data === "string" && base64Data.length > 0) {
    const sniffed = sniffImageType(Buffer.from(base64Data.slice(0, 24), "base64"));
    if (sniffed) return sniffed;
  }
  return "image/jpeg";
}

/** "jpeg", "png" or "webp": the deployed client adds the "image/" prefix itself. */
const bareSubtype = (mimeType) => mimeType.slice("image/".length);

/** Demo accounts: flagged in the database, or on the reserved demo domain. */
function isDemoUser(user) {
  return Boolean(user) && (user.demo === true || DEMO_EMAIL.test(String(user.email || "")));
}

function createdAtOf(doc) {
  const date = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();
  return date.toISOString();
}

function hasImage(doc) {
  return Boolean(doc.image && (doc.image.data || doc.image.contentType));
}

/**
 * Image URL, relative to the API origin, versioned so it can be cached for
 * good: by the image's content hash where one is set (demo documents), else
 * by when the document last changed (a new photo changes updatedAt).
 */
function imagePath(kind, doc) {
  const version =
    doc.imageVersion ||
    (doc.updatedAt ? new Date(doc.updatedAt) : doc._id.getTimestamp()).getTime();
  return `/api/${kind}/${toId(doc)}/image?v=${version}`;
}

function creatorSummary(user) {
  return {
    id: toId(user),
    // A scene whose creator no longer exists still renders.
    name: user.name || "Former member",
    avatarUrl: hasImage(user) ? imagePath("users", user) : null,
    isDemo: isDemoUser(user),
  };
}

/**
 * @param {object} user a user document or demo user
 * @param {{ sceneCount?: number }} [options]
 */
function serializeUser(user, { sceneCount } = {}) {
  return {
    ...creatorSummary(user),
    sceneCount: sceneCount ?? (Array.isArray(user.scenes) ? user.scenes.length : 0),
  };
}

/**
 * @param {object} scene a scene document or demo scene
 * @param {{ creator: object }} options the scene's creator (document or demo user)
 */
function serializeScene(scene, { creator }) {
  const credit = scene.credit && scene.credit.text ? scene.credit : null;
  const imageUrl = imagePath("scenes", scene);
  return {
    id: toId(scene),
    title: scene.title,
    description: scene.description,
    address: scene.address,
    location: { lat: scene.location.lat, lng: scene.location.lng },
    imageUrl,
    // Always present: the API serves the full photo when there is no card image.
    cardImageUrl: `${imageUrl}&size=card`,
    imageType: normaliseContentType(
      scene.image && scene.image.contentType,
      scene.image && scene.image.data,
    ),
    createdAt: createdAtOf(scene),
    credit: credit ? { text: credit.text, url: credit.url || null } : null,
    isDemo: isDemoUser(creator),
    creator: creatorSummary(creator),
  };
}

function legacyImage(doc) {
  const data = (doc.image && doc.image.data) || "";
  const contentType = bareSubtype(normaliseContentType(doc.image && doc.image.contentType, data));
  return { image: { data, contentType }, contentType };
}

/**
 * DEPRECATED shape, kept while the deployed client still reads it
 * (GET /api/users/users). It inlines the avatar bytes; `contentType` is the
 * bare subtype at the top level and inside `image`.
 */
function legacyUser(user) {
  return {
    id: toId(user),
    _id: toId(user),
    name: user.name,
    ...legacyImage(user),
    scenes: (user.scenes || []).map(toId),
    isDemo: isDemoUser(user),
  };
}

/**
 * DEPRECATED shape, kept while the deployed client still reads it
 * (GET /api/scenes/user/:userId and the edit page's GET /api/scenes/:id).
 * `creator` is the creator's id, which the client compares with the
 * signed-in user to show Edit and Delete.
 */
function legacyScene(scene, { creator }) {
  return {
    id: toId(scene),
    _id: toId(scene),
    title: scene.title,
    description: scene.description,
    address: scene.address,
    location: { lat: scene.location.lat, lng: scene.location.lng },
    creator: toId(creator),
    ...legacyImage(scene),
    isDemo: isDemoUser(creator),
  };
}

/**
 * DEPRECATED, for GET /api/scenes/:id only. The deployed client's edit page
 * only enables Save once scene.image.contentType and scene.image.data exist.
 * An empty data string keeps that form working without resending the bytes.
 * Remove together with the other legacy shapes.
 */
function legacyEditFields(scene) {
  const contentType = bareSubtype(normaliseContentType(scene.image && scene.image.contentType));
  return { image: { contentType, data: "" } };
}

module.exports = {
  serializeUser,
  serializeScene,
  legacyUser,
  legacyScene,
  legacyEditFields,
  normaliseContentType,
  isDemoUser,
};
