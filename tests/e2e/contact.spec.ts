// @flow - the contact form (Contact.tsx), the page's one way to reach a person. It checks
// itself and sends: a name, an e-mail that looks like one and a few words are asked for, the
// company is not, each missing one says so in a sentence under its field and clears as it is
// typed in, and a complete form goes to the Worker (cloudflare/contact-worker.js) - here the
// suite's inbox - and says it arrived. When it does not arrive, the visitor is not left with
// nothing: the message is there to copy, and can be edited again.

import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { openHome, scrollToSection } from "./support/page";

const ERRORS = {
  name: "Tell us what to call you.",
  email: "Enter an email like name@company.com.",
  msg: "Write a few words about what you're dealing with.",
};

async function openForm(page: Page) {
  await openHome(page);
  await scrollToSection(page, "contact");
  return page.locator("#contact");
}

const field = (page: Page, label: string) => page.locator("#contact .fld").filter({ has: page.getByLabel(label, { exact: true }) });

async function fillJana(page: Page) {
  const c = page.locator("#contact");
  await c.getByLabel("Name", { exact: true }).fill("Jana Nováková");
  await c.getByLabel("Company (optional)", { exact: true }).fill("Pekárna U Mlýna");
  // Spaces round an address are a slip of the keyboard; the address is read without them.
  await c.getByLabel("Email", { exact: true }).fill("  jana@pekarna.cz ");
  await c.getByLabel("What are you dealing with?", { exact: true }).fill("Our monthly report comes from six spreadsheets.");
  await c.getByLabel("What are you dealing with?", { exact: true }).press("Tab");
}

test.describe("@flow the contact form", () => {
  test("names its fields, and asks for nothing the visitor has not been told about", async ({ page }) => {
    const c = await openForm(page);
    await expect(c.getByRole("heading", { level: 2 })).toHaveText("See appolino on your own data.");
    for (const label of ["Name", "Company (optional)", "Email", "What are you dealing with?"]) await expect(c.getByLabel(label, { exact: true })).toBeVisible();
    await expect(c.getByLabel("Email", { exact: true })).toHaveAttribute("type", "email");
    await expect(c.getByLabel("Name", { exact: true })).toHaveAttribute("autocomplete", "name");
    await expect(c.locator(".err")).toHaveCount(0);
    // The field that catches bots is neither seen nor reached by a person.
    await expect(page.locator("#f-website")).toBeHidden();
  });

  test("an empty form says what each required field needs, and the company is not one of them", async ({ page, inbox }) => {
    const c = await openForm(page);
    await c.getByRole("button", { name: "Send message" }).click();
    await expect(field(page, "Name").locator(".err")).toHaveText(ERRORS.name);
    await expect(field(page, "Email").locator(".err")).toHaveText(ERRORS.email);
    await expect(field(page, "What are you dealing with?").locator(".err")).toHaveText(ERRORS.msg);
    await expect(field(page, "Company (optional)").locator(".err")).toHaveCount(0);
    await expect(c.locator(".fld.bad")).toHaveCount(3);
    // Still the form, and nothing was sent.
    await expect(c.getByText("Message sent")).toHaveCount(0);
    expect(inbox.received).toEqual([]);
  });

  test("an error clears as its field is typed in; spaces alone are not an answer", async ({ page }) => {
    const c = await openForm(page);
    await c.getByRole("button", { name: "Send message" }).click();
    await c.getByLabel("Name", { exact: true }).fill("J");
    await expect(field(page, "Name").locator(".err")).toHaveCount(0);
    await expect(field(page, "Email").locator(".err")).toHaveText(ERRORS.email);

    await c.getByLabel("Name", { exact: true }).fill("   ");
    await c.getByLabel("What are you dealing with?", { exact: true }).fill("   ");
    await c.getByRole("button", { name: "Send message" }).click();
    await expect(field(page, "Name").locator(".err")).toHaveText(ERRORS.name);
    await expect(field(page, "What are you dealing with?").locator(".err")).toHaveText(ERRORS.msg);
  });

  for (const email of ["jana", "jana@", "jana@firma", "jana @firma.cz", "@firma.cz"]) {
    test(`"${email}" is not taken as an e-mail`, async ({ page, inbox }) => {
      const c = await openForm(page);
      await c.getByLabel("Name", { exact: true }).fill("Jana Nováková");
      await c.getByLabel("Email", { exact: true }).fill(email);
      await c.getByLabel("What are you dealing with?", { exact: true }).fill("Six spreadsheets every month.");
      await c.getByRole("button", { name: "Send message" }).click();
      await expect(field(page, "Email").locator(".err")).toHaveText(ERRORS.email);
      await expect(c.locator(".err")).toHaveCount(1);
      expect(inbox.received).toEqual([]);
    });
  }

  test("a complete form is sent once, as it was checked, and says it arrived", async ({ page, inbox }) => {
    const c = await openForm(page);
    await fillJana(page);
    await c.getByRole("button", { name: "Send message" }).click();

    await expect(c.getByText("Message sent")).toBeVisible();
    await expect(c.getByRole("heading", { level: 3 })).toHaveText("Thanks, Jana.");
    await expect(c.getByText("It reached us. We'll write back to jana@pekarna.cz.")).toBeVisible();
    // What was checked is what is sent: the address as it was read, without the spaces; and the
    // trap empty, as a person leaves it.
    expect(inbox.received).toEqual([{ name: "Jana Nováková", company: "Pekárna U Mlýna", email: "jana@pekarna.cz", msg: "Our monthly report comes from six spreadsheets.", website: "" }]);
  });

  test("without a company, the company goes empty; Enter in a field sends, as a form does", async ({ page, inbox }) => {
    const c = await openForm(page);
    await c.getByLabel("Name", { exact: true }).fill("Petr");
    await c.getByLabel("Email", { exact: true }).fill("petr@firma.cz");
    await c.getByLabel("What are you dealing with?", { exact: true }).fill("Bank statements by hand.");
    await c.getByLabel("Email", { exact: true }).press("Enter");
    await expect(c.getByText("Message sent")).toBeVisible();
    expect(inbox.received).toEqual([{ name: "Petr", company: "", email: "petr@firma.cz", msg: "Bank statements by hand.", website: "" }]);
  });

  test("when sending fails, the message is there to copy, and can be edited and sent again", async ({ page, context, browserName, inbox, guard }) => {
    guard.allowConsole(/502|Failed to load resource/);
    inbox.answer(502);
    const c = await openForm(page);
    await fillJana(page);
    await c.getByRole("button", { name: "Send message" }).click();

    await expect(c.getByText("Your message is ready")).toBeVisible();
    await expect(c.getByText("It did not go through. Copy the message and email it to us.")).toBeVisible();
    const message = c.locator("pre");
    expect(await message.textContent()).toBe("Name: Jana Nováková\nCompany: Pekárna U Mlýna\nEmail: jana@pekarna.cz\n\nOur monthly report comes from six spreadsheets.");

    // Copied where the browser lets the page write to the clipboard; selected for Ctrl+C where
    // it does not. Either way the visitor is told which.
    if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await c.getByRole("button", { name: "Copy message" }).click();
    await expect(c.locator(".note")).toHaveText(/^(Copied\.|The text is selected\. Copy it with ⌘C or Ctrl\+C\.)$/);
    // Windows' clipboard writes its own line ends.
    if (browserName === "chromium") expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(await message.textContent());

    await c.getByRole("button", { name: "Edit" }).click();
    await expect(c.getByLabel("Name", { exact: true })).toHaveValue("Jana Nováková");
    await expect(c.getByLabel("Company (optional)", { exact: true })).toHaveValue("Pekárna U Mlýna");
    inbox.answer(200);
    await c.getByRole("button", { name: "Send message" }).click();
    await expect(c.getByText("Message sent")).toBeVisible();
    expect(inbox.received).toHaveLength(2);
  });
});
