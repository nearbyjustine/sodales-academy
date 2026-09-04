import { seedTracks } from "./seed-tracks";

seedTracks()
  .then(({ created, skipped }) => {
    console.log(`Tracks seeded. created=${created} skipped=${skipped}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
