// Opens the test browser profile so you can sign in to both Sitecore installs once.
// Close the browser window when you're done; the sign-in stays in .auth/profile.
import env from "./sitecore-env.js";

const { context } = await env.launchSitecore({ headless: false });
for (const host of Object.values(env.HOSTS)) {
  const page = await context.newPage();
  await page.goto(`${host}/sitecore/shell/default.aspx`);
}
console.log("Sign in to each tab, then close the browser window.");
await new Promise((resolve) => context.on("close", resolve));
