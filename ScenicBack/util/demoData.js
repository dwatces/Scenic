/* Demo content: two members and three New Zealand scenes. Served while no
   database is connected (see app.js) and copied into a real one by
   util/seedAtlas.js. Accounts use the reserved @scenic.example domain and
   demo: true, so the app labels them ("Demo account", "Demo scene"). The
   photos are free-to-use Pexels photos, credited on each scene.

   Documents are shaped like database ones (24-hex ObjectIds, explicit
   createdAt), so demo mode runs the same id checks and serialisers. */
const { Types } = require("mongoose");
const images = require("./demoImages");

const id = (hex) => new Types.ObjectId(hex);

/** A stored image, shaped like an uploaded one (base64 in the document). */
const webp = (bytes) => ({ contentType: "image/webp", data: bytes.toString("base64") });

/** Credit for a Pexels photo, linking to its page there. */
const pexels = (photographer, slug) => ({
  text: `${photographer} on Pexels`,
  url: `https://www.pexels.com/photo/${slug}/`,
});

const IDS = {
  daniel: id("6ad72233e7b2b3491f9be98b"),
  aroha: id("6ad72233e7b2b3491f9be98c"),
  milford: id("6ad72233e7b2b3491f9be98d"),
  tekapo: id("6ad72233e7b2b3491f9be98e"),
  cathedralCove: id("6ad72233e7b2b3491f9be98f"),
};

const USERS = [
  {
    _id: IDS.daniel,
    name: "Daniel",
    email: "daniel@scenic.example",
    demo: true,
    image: webp(images.avatarDaniel),
    scenes: [IDS.milford, IDS.tekapo],
    createdAt: new Date("2026-06-20T09:00:00Z"),
  },
  {
    _id: IDS.aroha,
    name: "Aroha",
    email: "aroha@scenic.example",
    demo: true,
    image: webp(images.avatarAroha),
    scenes: [IDS.cathedralCove],
    createdAt: new Date("2026-06-20T09:05:00Z"),
  },
];

const SCENES = [
  {
    _id: IDS.milford,
    title: "Milford Sound",
    description: "A cruise boat heads out under Mitre Peak, which rises straight out of the fiord.",
    address: "Milford Sound, Fiordland",
    location: { lat: -44.6717, lng: 167.9256 },
    creator: IDS.daniel,
    image: webp(images.milfordSound),
    thumb: webp(images.milfordSoundCard),
    credit: pexels("Ravish Maqsood", "cruise-milford-sound-new-zealand-17431554"),
    createdAt: new Date("2026-06-20T09:10:00Z"),
  },
  {
    _id: IDS.tekapo,
    title: "Lake Tekapo",
    description:
      "Lupins flower along the shore in early summer, in front of the lake's glacial blue water.",
    address: "Lake Tekapo, Canterbury",
    location: { lat: -44.0046, lng: 170.4771 },
    creator: IDS.daniel,
    image: webp(images.lakeTekapo),
    thumb: webp(images.lakeTekapoCard),
    credit: pexels("Chee Huey Wong", "purple-lavender-by-the-lake-62344"),
    createdAt: new Date("2026-06-20T09:15:00Z"),
  },
  {
    _id: IDS.cathedralCove,
    title: "Cathedral Cove",
    description: "Te Hoho Rock, framed by the sea arch at Cathedral Cove near Hahei.",
    address: "Hahei, Coromandel",
    location: { lat: -36.8277, lng: 175.7917 },
    creator: IDS.aroha,
    image: webp(images.cathedralCove),
    thumb: webp(images.cathedralCoveCard),
    credit: pexels(
      "Frank Schrader",
      "looking-at-te-hoho-rock-through-cathedral-cove-hahei-new-zealand-28240868",
    ),
    createdAt: new Date("2026-06-20T09:20:00Z"),
  },
];

const sameId = (a, b) => String(a) === String(b);
const findUser = (userId) => USERS.find((user) => sameId(user._id, userId)) || null;
const findScene = (sceneId) => SCENES.find((scene) => sameId(scene._id, sceneId)) || null;
const scenesOf = (user) => user.scenes.map(findScene).filter(Boolean);

module.exports = { USERS, SCENES, IDS, findUser, findScene, scenesOf };
