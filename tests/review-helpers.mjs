export async function openSection(page, id) {
  const fold = page.locator(`#${id} > .section-fold`);
  if (!await fold.evaluate(n => n.open)) await fold.locator(':scope > summary').click();
}
// Component regression fixtures expose details through their actual disclosures.
export async function openReviewDetails(page) {
  await page.locator('#plan:not([hidden])').waitFor();
  for (const id of ['technology-view','system-view','flow-view','questions-view']) {
    if (await page.locator('#'+id).isVisible()) await openSection(page,id);
  }
  for (const selector of ['.tech-card > details','.technical-detail','.decision-card','.own-answer']) {
    const folds=page.locator(selector);
    for(let i=0;i<await folds.count();i++) if(!await folds.nth(i).evaluate(n=>n.open)) await folds.nth(i).locator(':scope > summary').click();
  }
}

export async function askAbout(page, selector) {
  if(await page.locator('#ask-dialog').isVisible())await page.locator('#ask-close').click();
  await page.keyboard.press('Escape');await page.locator('#ask-toggle').click();
  await page.locator(selector).scrollIntoViewIfNeeded();await page.locator(selector).focus();await page.keyboard.press('Enter');
  await page.locator('#ask-dialog[open]').waitFor();
}
export async function annotatePart(page, selector) {
  if(await page.locator('#ask-dialog').isVisible())await page.locator('#ask-close').click();
  await page.keyboard.press('Escape');await page.locator('#annotate-toggle').click();await page.locator(selector).click();
}
