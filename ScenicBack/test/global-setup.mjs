// Starts one in-memory MongoDB replica set for the whole run (transactions
// need a replica set) and points every test file at it. Variables set here
// are inherited by the forked test workers. They are also set before the app
// loads dotenv, and dotenv never overrides an existing variable, so a
// developer's real ScenicBack/.env can't leak into a test run.
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

export const DB_PORT = 7107;

export default async function setup() {
  // 8.2.6 is the binary already in ~/.cache/mongodb-binaries. Locally a
  // missing binary fails the run instead of downloading 120 MB mid-test;
  // CI sets MONGOMS_RUNTIME_DOWNLOAD=true.
  process.env.MONGOMS_VERSION ??= "8.2.6";
  process.env.MONGOMS_RUNTIME_DOWNLOAD ??= process.env.CI ? "true" : "false";

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port: DB_PORT, launchTimeout: 60000 }],
  });
  const mongodPid = replSet.servers[0].instanceInfo?.instance?.mongodProcess?.pid;
  // mongodb-memory-server silently picks a random port when the requested one
  // is taken; this workspace may only use 7103-7109, so refuse to run instead.
  if (new URL(replSet.getUri()).port !== String(DB_PORT)) {
    await replSet.stop({ doCleanup: true, force: true });
    throw new Error(`Port ${DB_PORT} is busy: stop whatever holds it and run the tests again.`);
  }

  process.env.TEST_DB_BASE = replSet.getUri();
  process.env.DB_URL = replSet.getUri("scenic-test");
  process.env.JWT_KEY = "test-only-jwt-key";
  process.env.GOOGLE_API_KEY = "";
  process.env.SEED_PASSWORD = "test-only-seed-password";

  return async function teardown() {
    await replSet.stop({ doCleanup: true, force: true });
    if (mongodPid) {
      let alive = true;
      for (let i = 0; i < 50 && alive; i++) {
        try {
          process.kill(mongodPid, 0);
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          alive = false;
        }
      }
      if (alive) throw new Error(`mongod ${mongodPid} is still running after the test run`);
    }
  };
}
