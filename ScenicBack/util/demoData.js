/* Demo content: two demo members and three New Zealand scenes, served
   while no database is connected (see app.js) and copied into a real
   database by util/seedAtlas.js. Every account is on the reserved
   @scenic.example domain and flagged demo: true, so responses label it
   ("Demo account", "Demo scene"), and every image is a placeholder that
   says "Demo image" on it (util/demoImages.js).

   Documents are shaped like the database ones (24-hex ObjectIds, explicit
   createdAt), so demo mode goes through the same id checks and the same
   serialisers as database mode. */
const { Types } = require("mongoose");
const images = require("./demoImages");

const id = (hex) => new Types.ObjectId(hex);

/** A stored image, shaped like an uploaded one (base64 in the document). */
const webp = (bytes) => ({ contentType: "image/webp", data: bytes.toString("base64") });

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
    name: "Daniel (demo)",
    email: "daniel@scenic.example",
    demo: true,
    image: webp(images.avatarDaniel),
    scenes: [IDS.milford, IDS.tekapo],
    createdAt: new Date("2026-06-20T09:00:00Z"),
  },
  {
    _id: IDS.aroha,
    name: "Aroha (demo)",
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
    description: "Mitre Peak rises straight out of the fiord.",
    address: "Milford Sound, Fiordland",
    location: { lat: -44.6717, lng: 167.9256 },
    creator: IDS.daniel,
    image: webp(images.milfordSound),
    createdAt: new Date("2026-06-20T09:10:00Z"),
  },
  {
    _id: IDS.tekapo,
    title: "Lake Tekapo",
    description: "Lupins flower along the shore in early summer.",
    address: "Lake Tekapo, Canterbury",
    location: { lat: -44.0046, lng: 170.4771 },
    creator: IDS.daniel,
    image: webp(images.lakeTekapo),
    createdAt: new Date("2026-06-20T09:15:00Z"),
  },
  {
    _id: IDS.cathedralCove,
    title: "Cathedral Cove",
    description: "A sea arch between two beaches near Hahei.",
    address: "Hahei, Coromandel",
    location: { lat: -36.8277, lng: 175.7917 },
    creator: IDS.aroha,
    image: webp(images.cathedralCove),
    createdAt: new Date("2026-06-20T09:20:00Z"),
  },
];

const sameId = (a, b) => String(a) === String(b);
const findUser = (userId) => USERS.find((user) => sameId(user._id, userId)) || null;
const findScene = (sceneId) => SCENES.find((scene) => sameId(scene._id, sceneId)) || null;
const scenesOf = (user) => user.scenes.map(findScene).filter(Boolean);

module.exports = { USERS, SCENES, IDS, findUser, findScene, scenesOf };
