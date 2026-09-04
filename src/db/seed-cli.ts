import { runSeed } from "./seed";

runSeed()
  .then((result) => {
    console.log(`Seeded ${result.coursesImported} courses, ${result.lessonsImported} lessons.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
