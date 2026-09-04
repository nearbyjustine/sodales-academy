import { runSeed } from "./seed";

runSeed()
  .then(() => {
    console.log("Admin promoted.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
