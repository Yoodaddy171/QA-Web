import { expect, test } from '@playwright/test';

test('preserves inspector tabs, keyboard DevLog, narrow viewport and logout', async ({ page, request }) => {
  // Give the logout scenario its own session instead of revoking globalSetup's session.
  expect((await page.request.post('/api/auth/login',{data:{email:'owner@qa-desk.test',password:'E2E-only-password-2026!'}})).ok()).toBeTruthy();
  const projectResponse = await request.post('/api/projects', { data:{name:`Frontend regression ${Date.now()}`} });
  expect(projectResponse.ok()).toBeTruthy(); const project=await projectResponse.json();
  try {
    for(let n=1;n<=2;n++) {
      const response=await request.post('/api/testcases',{data:{projectId:project.id,testCaseId:`UI-${n}`,page:'Checkout',testType:'Positive',testAction:'Confirm order',steps:'Open checkout\nConfirm',expectedResult:'Order saved',status:'NOT DONE',priority:'High'}});
      expect(response.ok()).toBeTruthy();
    }
    await page.route('http://127.0.0.1:3001/**',route=>{
      const logs=Array.from({length:30},(_,n)=>({id:`ui-log-${n}`,category:'network',event:'network.response',relativeMs:n*1000,level:'INFO',network:{method:'POST',url:`https://fixture.example/api/orders/${n}`,status:200,duration:70,headers:{'Content-Type':'application/json'},data:{request:{order:n},response:{saved:true}}}}));
      return route.fulfill({contentType:'text/plain',body:route.request().url().includes('/logs/')?logs.map(l=>JSON.stringify(l)).join('\n'):'{"recording":null}'});
    });
    await page.routeWebSocket('ws://127.0.0.1:3001/**',ws=>ws.onMessage(()=>{}));
    await page.goto(`/projects/${project.id}/test-cases`);
    const status = page.getByRole('combobox',{name:'Status for UI-1'});
    await status.focus(); await page.keyboard.press('ArrowDown');
    await page.getByRole('option',{name:'FAILED',exact:true}).click();
    await expect(status).toContainText('FAILED');
    await expect(status).toBeFocused();
    await status.click(); await page.keyboard.press('Escape');
    await expect(status).toBeFocused();
    const selection = page.locator('tbody tr').first().getByRole('checkbox');
    await selection.click(); await expect(selection).toBeChecked();
    await selection.click(); await expect(selection).not.toBeChecked();
    await page.getByRole('columnheader',{name:'ID',exact:true}).click();
    await expect(page.locator('tbody tr').first()).toContainText('UI-2');
    await page.getByRole('columnheader',{name:'ID',exact:true}).click();
    await expect(page.locator('tbody tr').first()).toContainText('UI-1');
    await expect(status).toContainText('FAILED');
    await page.getByRole('button',{name:'Toggle theme'}).click();
    await page.getByRole('menuitem',{name:'Light',exact:true}).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-changing','');
    await page.getByText('UI-1',{exact:true}).first().click();
    for(const name of ['Overview','Steps','Execution','Evidence','Bugs','History','Comments','Traceability','Automation']) {
      await page.getByRole('tab',{name,exact:true}).click(); await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('data-state','active');
    }
    await page.getByRole('button',{name:/Network \(/}).click();
    const row=page.getByRole('button',{name:/Inspect POST/}).first();await row.focus();await page.keyboard.press('Enter');await expect(row).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Space');await expect(row).toHaveAttribute('aria-expanded','false');
    await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
    await page.getByRole('button',{name:'Close fullscreen DevLog'}).click();
    await page.getByRole('button',{name:'Fullscreen',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Close fullscreen DevLog'})).toBeHidden();
    await page.getByRole('button',{name:'Next test case'}).click();await expect(page.getByRole('tab',{name:'Automation',exact:true})).toHaveAttribute('data-state','active');
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();
    for(const width of [320,360,390,768,1440]) {
      await page.setViewportSize({width,height:900});await page.getByText('UI-1',{exact:true}).first().click();
      await expect.poll(async()=>page.getByRole('dialog').evaluate(e=>Math.round(e.getBoundingClientRect().left))).toBeGreaterThanOrEqual(0);
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Open QA AI chat'}).click();
      const chat=page.getByRole('button',{name:'Close chat'}).locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
      await expect.poll(async()=>chat.evaluate(e=>Math.round(e.getBoundingClientRect().right))).toBeLessThanOrEqual(width);
      await page.getByRole('button',{name:'Minimize chat'}).click();await page.getByRole('button',{name:'Expand chat'}).click();await page.getByRole('button',{name:'Close chat'}).click();
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Toggle theme'}).click();await page.getByRole('menuitem',{name:'Light',exact:true}).click();await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button',{name:'Menu akun'}).click();await page.getByRole('menuitem',{name:'Keluar'}).click();await expect(page).toHaveURL(/\/login/);
  } finally {
    // Logout revokes the shared storage-state session; authenticate the isolated fixture for cleanup.
    await request.post('/api/auth/login',{data:{email:'owner@qa-desk.test',password:'E2E-only-password-2026!'}});
    const cleanup=await request.delete(`/api/projects?id=${project.id}`);
    expect([200,404]).toContain(cleanup.status());
  }
});

test('latest rapid navigation intent wins',async({page})=>{
  await page.goto('/projects/e2e-project/dashboard');
  for(const name of ['Bugs','Automation Logs','Test Cycles','Traceability','Reports','Settings','Cases']) await page.locator('[data-sidebar="menu-button"]').filter({hasText:name}).first().click();
  await expect(page).toHaveURL(/\/test-cases$/);await expect(page.getByRole('heading',{name:'Cases',exact:true})).toBeVisible();
});
