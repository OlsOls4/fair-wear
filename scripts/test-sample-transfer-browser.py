"""Optional local-only sample handoff browser regression. No model calls.
Requires Python Playwright and Chromium; run against a mock production server.
Real BFCache coverage is reported separately when the browser uses it.
"""
from playwright.sync_api import sync_playwright, expect
import os, json
from pathlib import Path
BASE=os.environ.get('FAIRWEAR_TRANSFER_REVIEW_URL','http://127.0.0.1:3351')
KEY='fair-wear:sample-review:v1'; TRANSFER='fair-wear:sample-case-transfer:v1'
OUT = Path(os.environ.get('FAIRWEAR_TRANSFER_TEST_OUTPUT', '/tmp/fair-wear-sample-transfer')); OUT.mkdir(parents=True, exist_ok=True)
checks=[]
def ok(s): checks.append(s); print('ok',s,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('FAIRWEAR_TEST_BROWSER_PATH', '/usr/bin/chromium'),headless=True,args=['--no-sandbox'],ignore_default_args=['--disable-back-forward-cache'])
 context=browser.new_context(viewport={'width':1365,'height':1000},accept_downloads=True)
 context.add_init_script("window.__restored = false; addEventListener('pageshow', e => window.__restored = e.persisted);")
 page=context.new_page(); errors=[]; mutations=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('request',lambda r:mutations.append(r.url) if r.method not in ['GET','HEAD'] else None)
 dialog_accept=[True];page.on('dialog',lambda d:d.accept() if dialog_accept[0] else d.dismiss())
 def choose(id,value): page.locator('[data-finding-id="'+id+'"] select').select_option(value)
 page.goto(BASE+'/',wait_until='networkidle')
 expect(page.get_by_role('button',name='Bedroom',exact=True)).to_have_attribute('aria-pressed','true')
 expect(page.locator('.comparison-scene img').first).to_have_attribute('src','/demo/flat/bedroom-move-in.jpg')
 page.get_by_role('link',name='Try the sample review',exact=True).click()
 page.get_by_role('button',name='Review sample claim 1: bedroom carpet',exact=True).click()
 expect(page.locator('[data-finding-id="bedroom-carpet-0-0"]')).to_be_focused()
 ok('homepage starts with bedroom and its first guided stop reaches the transferable carpet claim')
 choose('bedroom-carpet-0-0','Agree');choose('kitchen-oven-0-0','Dispute');choose('bathroom-bath-0-0','Not claimed')
 board=page.evaluate('(key)=>sessionStorage.getItem(key)',KEY)
 page.get_by_role('button',name='Continue to case builder').click()
 expect(page.get_by_test_id('sample-review-handoff')).to_contain_text('3 selected sample responses')
 expect(page).to_have_url(BASE+'/case-builder')
 expect(page.get_by_test_id('case-summary')).to_contain_text('Questioned£80.00For discussion£480.00')
 expect(page.get_by_test_id('case-summary')).to_contain_text('1 item(s) left out')
 assert page.evaluate('(key)=>sessionStorage.getItem(key)',TRANSFER) is None
 assert page.locator('button[aria-pressed]').count()==3
 ok('explicit source CTA carries three mappings once, strips URL marker and adds no rows')
 expect(page.get_by_test_id('imported-review-response')).to_contain_text('sample review response: Discuss after evidence')
 expect(page.get_by_label('Discuss after evidence',exact=True)).to_be_checked()
 expect(page.get_by_text('The evaluation disagrees.',exact=True)).to_be_visible()
 page.get_by_label('What should your response say?').fill('REVIEW_SENTINEL_NOT_SAVED')
 page.get_by_label('Proposed amount in pounds',exact=True).fill('123.45')
 page.get_by_label('Question this deduction',exact=True).check()
 with page.expect_download() as info:page.get_by_role('button',name='Export current evidence bundle').click()
 path=OUT/'current-transfer-export.html';info.value.save_as(str(path));html=path.read_text()
 assert 'REVIEW_SENTINEL_NOT_SAVED' in html and 'Original verdict: damage' in html and 'Starting choice from sample review' in html
 assert 'Your selected sample review response: Discuss after evidence' in html and '£123.45' in html and 'Replace bath' not in html
 assert 'No amount is agreed in this draft.' in html
 assert page.evaluate('(key)=>sessionStorage.getItem(key)',KEY)==board
 assert page.evaluate('()=>JSON.stringify({...sessionStorage,...localStorage})').find('REVIEW_SENTINEL_NOT_SAVED')==-1
 ok('later edit drives export while source choice/model provenance remain separate; no note storage')
 # A persisted pageshow must not reapply an older choice over edited case state.
 page.evaluate("dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
 expect(page.get_by_label('Question this deduction',exact=True)).to_be_checked()
 expect(page.get_by_label('What should your response say?')).to_have_value('REVIEW_SENTINEL_NOT_SAVED')
 ok('persisted pageshow does not re-import or overwrite case edits')
 # Real back/forward navigation, recording whether this browser actually used BFCache.
 page.goto(BASE+'/demo',wait_until='networkidle');page.get_by_role('button',name='Reset suggested responses').click()
 page.go_back(wait_until='networkidle')
 bfcache=page.evaluate('window.__restored')
 if bfcache:
  expect(page.get_by_label('What should your response say?')).to_have_value('REVIEW_SENTINEL_NOT_SAVED')
  expect(page.get_by_label('Question this deduction',exact=True)).to_be_checked()
  ok('real BFCache return preserves independently edited case after source reset')
 else:
  assert page.get_by_test_id('sample-review-handoff').count()==0
  ok('browser used fresh Back navigation, which did not replay consumed transfer (BFCache not exercised)')
 # A fresh explicit transfer gets reset through cancel/confirm and then private mode.
 page.goto(BASE+'/demo',wait_until='networkidle');choose('bedroom-carpet-0-0','Agree')
 board=page.evaluate('(key)=>sessionStorage.getItem(key)',KEY)
 page.get_by_role('button',name='Continue to case builder').click()
 expect(page.get_by_test_id('sample-review-handoff')).to_contain_text('1 selected sample response')
 page.get_by_label('What should your response say?').fill('RESET_CANCEL_SENTINEL')
 dialog_accept[0]=False;page.get_by_role('button',name='Reset example case').click()
 expect(page.get_by_label('What should your response say?')).to_have_value('RESET_CANCEL_SENTINEL')
 dialog_accept[0]=True;page.get_by_role('button',name='Reset example case').click()
 assert page.get_by_test_id('sample-review-handoff').count()==0
 assert page.get_by_test_id('imported-review-response').count()==0
 expect(page.get_by_label('Question this deduction',exact=True)).to_be_checked()
 expect(page.get_by_label('What should your response say?')).to_have_value('')
 assert page.evaluate('(key)=>sessionStorage.getItem(key)',KEY)==board
 ok('reset cancellation preserves work; confirmed reset clears imported provenance and leaves Board choices')
 page.get_by_role('button',name='Start a private case').click()
 page.get_by_label('What should your response say?').fill('PERSONAL_SENTINEL_NOT_SAVED')
 assert page.locator('img').count()==0
 assert page.get_by_test_id('imported-review-response').count()==0
 assert page.evaluate('(key)=>sessionStorage.getItem(key)',KEY)==board
 assert 'PERSONAL_SENTINEL_NOT_SAVED' not in page.evaluate('()=>JSON.stringify({...sessionStorage,...localStorage})')
 page.get_by_role('button',name='Return to example').click()
 assert page.get_by_test_id('sample-review-handoff').count()==0
 expect(page.get_by_test_id('case-summary')).to_contain_text('Questioned£910.00For discussion£0.00')
 ok('private mode never imports/stores case data; return to example does not replay transfer')
 # Normal entry must ignore an unconsumed marker until that exact explicit URL is used.
 token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 seed={'version':1,'revision':json.loads(board)['revision'],'token':token,'responses':{'kitchen-oven-0-0':'Not claimed'}}
 page.evaluate('([key,value])=>sessionStorage.setItem(key,JSON.stringify(value))',[TRANSFER,seed])
 page.goto(BASE+'/case-builder',wait_until='networkidle')
 assert page.get_by_test_id('sample-review-handoff').count()==0
 expect(page.get_by_test_id('case-summary')).to_contain_text('Questioned£910.00For discussion£0.00')
 assert page.evaluate('(key)=>sessionStorage.getItem(key)',TRANSFER) is not None
 explicit=BASE+'/case-builder?from=sample-review&transfer='+token
 page.goto(explicit,wait_until='networkidle')
 expect(page.get_by_test_id('sample-review-handoff')).to_contain_text('1 selected sample response')
 expect(page.get_by_test_id('case-summary')).to_contain_text('1 item(s) left out')
 page.goto(explicit,wait_until='networkidle')
 assert page.get_by_test_id('sample-review-handoff').count()==0
 expect(page.get_by_role('status').filter(has_text='No responses were imported')).to_be_visible()
 expect(page.get_by_test_id('case-summary')).to_contain_text('Questioned£910.00For discussion£0.00')
 ok('ordinary entry ignores pending transfer; exact marker applies once and replay imports nothing')
 # Inspect the handoff and export controls at a narrow phone width.
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 mp=mobile.new_page();mp.goto(BASE+'/demo',wait_until='networkidle')
 mp.locator('[data-finding-id="bedroom-carpet-0-0"] select').select_option('Agree')
 mp.get_by_role('button',name='Continue to case builder').click()
 expect(mp.get_by_test_id('sample-review-handoff')).to_contain_text('1 selected sample response')
 assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow'
 mp.screenshot(path=str(OUT/'transfer-mobile.png'),full_page=True)
 page.screenshot(path=str(OUT/'transfer-replay-desktop.png'),full_page=True)
 ok('390px handoff layout has no horizontal overflow')
 assert not mutations,mutations
 assert not errors,errors
 ok('no non-GET request or browser error during independent flow')
 print(json.dumps({'checks':len(checks),'bfcache_actual':bfcache,'results':checks},indent=2))
 browser.close()
