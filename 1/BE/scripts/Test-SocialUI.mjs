// Invoked by Test-Social.ps1 with two temporary account tokens on stdin.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { tokenA, tokenB, question, email, password } = JSON.parse(input);
const origin = new URL(process.env.FORA_UI_ORIGIN || 'http://127.0.0.1:5173').origin;
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = await mkdtemp(resolve(tmpdir(), 'fora-poll-ui-'));
const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9339', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let browserError;
browser.on('error', error => { browserError = error; });
let socket;

async function waitFor(check, message) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await delay(200);
  }
  throw new Error(message);
}

function connect(url) {
  socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
}

async function api(token, path, body) {
  const response = await fetch(origin + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Fixture request failed: ' + path + ' HTTP ' + response.status);
  return response.json();
}

const pending = new Map();
let next = 0;
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++next;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Chrome command timed out: ' + method));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function tab(token, width, height, mobile, url = origin + '/feed', readySelector = '.composer-card') {
  const { browserContextId } = await call('Target.createBrowserContext');
  const { targetId } = await call('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const command = (method, params) => call(method, params, sessionId);
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };

  await command('Page.enable');
  if (token) {
    await command('Page.addScriptToEvaluateOnNewDocument', {
      source: 'if (location.origin === ' + JSON.stringify(origin) + ') localStorage.setItem("token", ' + JSON.stringify(token) + ')',
    });
  }
  await command('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 });
  await command('Page.navigate', { url });
  await waitFor(() => evaluate('!!document.querySelector(' + JSON.stringify(readySelector) + ')'), 'Browser page did not load');
  return { command, evaluate };
}

async function setValue(page, selector, value) {
  const expression = '(() => { const input = document.querySelector(' + JSON.stringify(selector) + ');' +
    'Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set.call(input, ' + JSON.stringify(value) + ');' +
    'input.dispatchEvent(new Event("input", { bubbles: true })); })()';
  await page.evaluate(expression);
}

async function click(page, buttonList, label) {
  const clicked = await page.evaluate('(() => { const button = [...document.querySelectorAll(' + JSON.stringify(buttonList) +
    ')].find(item => item.textContent.includes(' + JSON.stringify(label) + '));' +
    'if (!button || button.disabled) return false; button.click(); return true; })()');
  if (!clicked) throw new Error('Button not available: ' + label);
}

try {
  let debuggerUrl;
  await waitFor(async () => {
    if (browserError) throw browserError;
    try {
      const response = await fetch('http://127.0.0.1:9339/json/version');
      debuggerUrl = (await response.json()).webSocketDebuggerUrl;
      return !!debuggerUrl;
    } catch {
      return false;
    }
  }, 'Chrome debugging endpoint unavailable');
  await connect(debuggerUrl);
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    const entry = pending.get(data.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error.message));
    else entry.resolve(data.result);
  });

  const desktop = await tab(tokenA, 1366, 1000, false);
  const mobile = await tab(tokenB, 390, 844, true);
  await click(desktop, '.composer-card button', 'Create poll');
  await setValue(desktop, 'textarea[aria-label="Poll question"]', question);
  await setValue(desktop, '.poll-editor input', 'Library');
  await setValue(desktop, '.poll-editor label:nth-of-type(2) input', 'Sports courts');
  await click(desktop, '.poll-editor button', 'Add option');
  await setValue(desktop, '.poll-editor label:nth-of-type(3) input', 'Student network');
  await click(desktop, '.composer-card button', 'Post poll');

  const card = '[...document.querySelectorAll(".post-card")].find(card => card.querySelector(".p-content")?.textContent === ' + JSON.stringify(question) + ')';
  const pollText = '(' + card + ')?.querySelector(".post-poll")?.textContent || ""';
  const pollState = page => page.evaluate(pollText);
  await waitFor(async () => (await pollState(desktop)).includes('Live results'), 'New live poll not visible on desktop');
  await click(mobile, '.social-heading button', 'Refresh');
  await waitFor(async () => (await pollState(mobile)).includes('Live results'), 'Live poll not visible on mobile');
  console.log('PASS: created a three-option poll from the feed');

  const postId = await desktop.evaluate('(' + card + ').dataset.postId');
  const buttons = '[data-post-id="' + postId + '"] .poll-option';
  await click(mobile, buttons, 'Sports courts');
  await waitFor(async () => (await pollState(mobile)).includes('Your vote'), 'Mobile vote was not recorded');
  await waitFor(async () => (await pollState(desktop)).includes('Sports courts100%'), 'Desktop did not receive the result live');
  console.log('PASS: mobile vote updated desktop without refreshing');

  await click(desktop, buttons, 'Library');
  await waitFor(async () => (await pollState(mobile)).includes('2 votes') &&
    (await pollState(mobile)).includes('Library50%'), 'Mobile did not receive the second vote live');
  console.log('PASS: desktop vote updated mobile without refreshing');

  await mobile.command('Page.reload');
  await waitFor(async () => (await pollState(mobile)).includes('Your vote') && (await pollState(mobile)).includes('2 votes'),
    'Reload did not retain the selected option and totals');
  if (!await mobile.evaluate('[...document.querySelectorAll(' + JSON.stringify(buttons) + ')].every(button => button.disabled)')) {
    throw new Error('Voting controls remained enabled after voting');
  }
  if (!await mobile.evaluate('[...document.querySelectorAll(' + JSON.stringify(buttons) + ')].every(button => getComputedStyle(button).opacity === "1")')) {
    throw new Error('Results were dimmed after voting');
  }
  console.log('PASS: reload retained the vote and disabled repeat voting');

  const concurrent = await fetch(origin + '/api/posts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: question + ' (race)', poll: { options: ['One', 'Two'], durationHours: 1 } }),
  });
  if (!concurrent.ok) throw new Error('Could not create concurrent-vote fixture');
  const { id } = await concurrent.json();
  const voteUrl = origin + '/api/posts/' + id + '/poll/vote';
  const votes = await Promise.all([1, 2].map(optionNumber => fetch(voteUrl, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionNumber }),
  })));
  if (votes.map(response => response.status).sort().join(',') !== '200,409') {
    throw new Error('Expected concurrent conflicting votes to produce 200 and 409');
  }
  const result = await votes.find(response => response.ok).json();
  if (result.options.reduce((sum, option) => sum + option.voteCount, 0) !== 1) throw new Error('More than one vote was counted');
  console.log('PASS: concurrent votes from the same account counted once');

  const output = resolve('.qa', 'poll-ui');
  await mkdir(output, { recursive: true });
  for (const [name, page] of [['desktop', desktop], ['mobile', mobile]]) {
    if (await page.evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Horizontal overflow on ' + name);
    await page.evaluate('(' + card + ').scrollIntoView({ block: "center" })');
    await delay(350);
    const capture = await page.command('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(output, name + '.png'), Buffer.from(capture.data, 'base64'));
    console.log('PASS: poll rendered without horizontal overflow on ' + name);
  }

  const discussion = await api(tokenA, '/posts', { content: 'How should we present our project?' });
  const postSelector = '[data-post-id="' + discussion.id + '"]';
  await click(desktop, '.social-heading button', 'Refresh');
  await waitFor(() => desktop.evaluate('!!document.querySelector(' + JSON.stringify(postSelector) + ')'), 'Discussion post missing from feed');
  await desktop.evaluate('document.querySelector(' + JSON.stringify(postSelector + ' .act-btn.comment') + ').click()');
  await waitFor(() => desktop.evaluate('!!document.querySelector(' + JSON.stringify(postSelector + ' .thread-composer textarea') + ')'),
    'Inline comments did not open on the feed');
  await desktop.evaluate('document.querySelector(' + JSON.stringify(postSelector + ' a[aria-label="Open post"]') + ').click()');
  await waitFor(() => desktop.evaluate('location.pathname === "/posts/' + discussion.id + '" && !!document.querySelector(".thread-composer textarea")'),
    'Post link did not open the discussion');
  await setValue(desktop, '.thread-composer textarea', 'Should we show the feed first?');
  await click(desktop, '.thread-composer button', 'Post comment');
  await waitFor(() => desktop.evaluate('document.querySelector(".thread-root .thread-text")?.textContent === "Should we show the feed first?"'),
    'New root comment did not appear');
  const parentId = Number(await desktop.evaluate('document.querySelector(".thread-root article").id.replace("comment-", "")'));
  console.log('PASS: opened inline comments and a standalone post from the feed, then wrote a comment');

  const postUrl = origin + '/posts/' + discussion.id;
  const root = '#comment-' + parentId;
  await mobile.command('Page.navigate', { url: postUrl });
  await waitFor(() => mobile.evaluate('!!document.querySelector("' + root + '")'), 'Root missing on mobile');
  const editVisible = await mobile.evaluate('[...document.querySelectorAll("' + root + ' .comment-tools button")].some(button => ["Edit","Delete"].includes(button.textContent))');
  if (editVisible) throw new Error('Non-author was offered edit or delete');
  await click(mobile, root + ' .comment-tools button', 'Reply');
  await setValue(mobile, root + ' textarea', 'Yes, then show the live poll.');
  await click(mobile, root + ' form button', 'Send reply');
  await waitFor(() => mobile.evaluate('document.querySelector(".thread-replies .thread-text")?.textContent === "Yes, then show the live poll."'),
    'Reply did not appear under its parent');
  const replyId = Number(await mobile.evaluate('document.querySelector(".thread-replies article").id.replace("comment-", "")'));
  const reply = '#comment-' + replyId;
  await click(mobile, reply + ' .comment-tools button', 'Reply');
  if (!await mobile.evaluate('document.querySelector("' + reply + ' textarea").value.startsWith("@Lan ")')) {
    throw new Error('Replying to a reply did not prefill the recipient');
  }
  await click(mobile, reply + ' form button', 'Cancel');
  console.log('PASS: mobile replied one level deep with correct ownership controls');

  for (let index = 1; index <= 10; index++) {
    await api(tokenA, '/comments', { postId: discussion.id, content: 'Later comment ' + index });
    await api(tokenB, '/comments', { postId: discussion.id, parentCommentId: parentId, content: 'Later reply ' + index });
  }
  await desktop.command('Page.reload');
  await waitFor(() => desktop.evaluate('document.querySelectorAll(".thread-root").length === 10'), 'Root comments were not paginated');
  if (await desktop.evaluate('!!document.querySelector("' + root + '")')) throw new Error('Older root leaked into the first page');
  await click(desktop, '.comment-thread > button', 'Load more comments');
  await waitFor(() => desktop.evaluate('!!document.querySelector("' + root + '")'), 'Older root did not load');
  await click(desktop, '.thread-reply-toggle', 'Show replies (11)');
  await waitFor(() => desktop.evaluate('document.querySelectorAll(".thread-replies article").length === 10'), 'Replies were not paginated');
  await click(desktop, '.thread-replies > button', 'Load more replies');
  await waitFor(() => desktop.evaluate('!!document.querySelector("' + reply + '")'), 'Older reply did not load');
  console.log('PASS: loaded additional root comments and replies separately');

  const deepLink = await desktop.evaluate("document.querySelector(" + JSON.stringify(reply + ' a[aria-label="Open comment link"]') + ").href");
  await desktop.command('Page.navigate', { url: deepLink });
  await waitFor(() => desktop.evaluate('document.activeElement.id === "comment-' + replyId + '" && document.activeElement.classList.contains("thread-highlight")'),
    'Direct link did not find, focus and highlight the older reply');
  await click(desktop, root + ' .comment-tools button', 'Edit');
  await setValue(desktop, root + ' textarea', 'Edited: show the feed first.');
  await click(desktop, root + ' form button', 'Save comment');
  await waitFor(() => desktop.evaluate('document.querySelector("' + root + '").textContent.includes("Edited: show the feed first.") && ' +
    '[...document.querySelectorAll("' + root + ' button")].some(button => button.textContent === "Delete" && !button.disabled)'),
    'Root edit did not appear');
  await click(desktop, root + ' .comment-tools button', 'Delete');
  await waitFor(() => desktop.evaluate('[...document.querySelectorAll("' + root + ' button")].some(button => button.textContent === "Confirm delete")'),
    'Delete confirmation did not appear');
  await click(desktop, root + ' .comment-tools button', 'Confirm delete');
  await waitFor(() => desktop.evaluate('document.querySelector("' + root + '").textContent.includes("Comment deleted") && !!document.querySelector("' + reply + '")'),
    'Deleting the root removed the discussion or exposed old text');
  console.log('PASS: link opened an older reply and author edits/deletion preserved the thread');

  await mobile.command('Page.navigate', { url: deepLink });
  await waitFor(() => mobile.evaluate('document.activeElement.id === "comment-' + replyId + '"'), 'Mobile direct link did not highlight the reply');
  if (await mobile.evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Mobile discussion overflow');
  const commentOutput = resolve('.qa', 'comment-ui');
  await mkdir(commentOutput, { recursive: true });
  for (const [name, page] of [['desktop', desktop], ['mobile', mobile]]) {
    await page.evaluate('document.querySelector("' + reply + '").scrollIntoView({ block: "center" })');
    const capture = await page.command('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(commentOutput, name + '.png'), Buffer.from(capture.data, 'base64'));
  }
  console.log('PASS: deep-linked reply and deleted root rendered on desktop and mobile');

  const visitor = await tab(null, 1366, 1000, false, deepLink, 'input[autocomplete="username"]');
  await setValue(visitor, 'input[autocomplete="username"]', email);
  await setValue(visitor, 'input[autocomplete="current-password"]', password);
  await click(visitor, 'form.authv2-form button[type="submit"]', 'Login');
  await waitFor(() => visitor.evaluate('location.href === ' + JSON.stringify(deepLink) +
    ' && document.activeElement.id === "comment-' + replyId + '"'), 'Login did not return to the shared reply');
  console.log('PASS: shared reply link returned to the exact comment after signing in');

  await desktop.command('Page.bringToFront');
  await desktop.command('Page.navigate', { url: origin + '/profile' });
  await waitFor(() => desktop.evaluate('location.pathname === "/profile" && !!document.querySelector(' + JSON.stringify(postSelector + ' .act-btn.comment') + ')'),
    'Discussion post did not appear in its author profile');
  const profileCommentButton = JSON.stringify(postSelector + ' .act-btn.comment');
  await desktop.evaluate('document.querySelector(' + profileCommentButton + ').click()');
  try {
    await waitFor(() => desktop.evaluate('document.querySelectorAll(' + JSON.stringify(postSelector + ' .thread-root') + ').length === 10'),
      'Author profile did not use paged inline comments');
  } catch (error) {
    const details = await desktop.evaluate('({ path: location.pathname, expanded: document.querySelector(' + profileCommentButton +
      ')?.getAttribute("aria-expanded"), discussion: document.querySelector(' + JSON.stringify(postSelector + ' .comment-thread') +
      ')?.textContent.slice(0, 180) })');
    throw new Error(error.message + ': ' + JSON.stringify(details));
  }
  console.log('PASS: opened paged inline comments from the author profile');

  for (const token of [tokenA, tokenB]) {
    const response = await fetch(origin + '/api/notifications/read-all',
      { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Could not reset the fixture inbox');
  }
  const unread = count => 'document.querySelector(".notifications-trigger")?.getAttribute("aria-label") === ' +
    JSON.stringify(count ? 'Notifications (' + count + ' unread)' : 'Notifications');
  await waitFor(() => mobile.evaluate(unread(0)), 'Read-all did not clear the badge');

  await desktop.command('Page.navigate', { url: origin + '/feed' });
  await waitFor(() => desktop.evaluate('[...document.querySelectorAll(".person-info a")].some(link => link.textContent === "Lan")'),
    'Lan was missing from Discover people');
  await desktop.evaluate('[...document.querySelectorAll(".person-info a")].find(link => link.textContent === "Lan").click()');
  await waitFor(() => desktop.evaluate('document.querySelector(".member-summary h1")?.textContent === "Lan"'), 'Member link did not open Lan’s profile');
  await click(desktop, '.member-summary button', 'Follow');
  await waitFor(() => desktop.evaluate('document.querySelector(".member-summary button")?.textContent === "Unfollow"'), 'Follow did not update the member profile');
  await waitFor(() => mobile.evaluate(unread(1)), 'Recipient did not receive a live follow notification');
  if (!await desktop.evaluate(unread(0))) throw new Error('The follower received a notification for their own action');
  await mobile.evaluate('document.querySelector(".notifications-trigger").click()');
  await waitFor(() => mobile.evaluate('document.querySelector(".notification-item")?.textContent.includes("Minh followed you")'), 'Follow notification missing');
  await click(mobile, '.notification-item', 'Minh followed you');
  await waitFor(() => mobile.evaluate('document.querySelector(".member-summary h1")?.textContent === "Minh" && ' + unread(0)),
    'Reading the follow alert did not open the actor profile and clear the badge');
  console.log('PASS: followed from a member profile and opened the follower from a private live notification');

  await waitFor(() => mobile.evaluate('!!document.querySelector(' + JSON.stringify(postSelector + ' a[aria-label="Open post"]') + ')'),
    'Member profile did not show the author’s post');
  if (await mobile.evaluate('!!document.querySelector(' + JSON.stringify(postSelector + ' [aria-label="Edit post"]') + ')')) {
    throw new Error('Another member’s profile offered post editing');
  }
  await mobile.evaluate('document.querySelector(' + JSON.stringify(postSelector + ' a[aria-label="Open post"]') + ').click()');
  await waitFor(() => mobile.evaluate('!!document.querySelector(".thread-composer textarea")'), 'Could not open the post from the member profile');
  await setValue(mobile, '.thread-composer textarea', 'I can take the first demo slot.');
  await click(mobile, '.thread-composer button', 'Post comment');
  await waitFor(() => desktop.evaluate(unread(1)), 'Post author did not receive the comment notification live');
  await desktop.evaluate('document.querySelector(".notifications-trigger").click()');
  await waitFor(() => desktop.evaluate('document.querySelector(".notification-item")?.textContent.includes("Lan commented on your post")'),
    'Comment notification missing');
  const inboxOutput = resolve('.qa', 'notification-ui');
  await mkdir(inboxOutput, { recursive: true });
  const inbox = await desktop.command('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(inboxOutput, 'desktop.png'), Buffer.from(inbox.data, 'base64'));
  await click(desktop, '.notification-item', 'Lan commented on your post');
  await waitFor(() => desktop.evaluate('document.activeElement.classList.contains("thread-highlight") && ' +
    'document.activeElement.textContent.includes("I can take the first demo slot.") && ' + unread(0)),
    'Reading the comment alert did not focus the exact comment');
  console.log('PASS: comment notification arrived live and opened the exact comment as read');

  const notifiedRoot = await desktop.evaluate('document.activeElement.id');
  await click(desktop, '#' + notifiedRoot + ' .comment-tools button', 'Reply');
  await setValue(desktop, '#' + notifiedRoot + ' textarea', 'Great, I will present the results.');
  await click(desktop, '#' + notifiedRoot + ' form button', 'Send reply');
  await waitFor(() => mobile.evaluate(unread(1)), 'Comment author did not receive the reply notification live');
  await mobile.evaluate('document.querySelector(".notifications-trigger").click()');
  await waitFor(() => mobile.evaluate('document.querySelector(".notification-item")?.textContent.includes("Minh replied to your comment")'),
    'Reply notification missing');
  await click(mobile, '.notification-item', 'Minh replied to your comment');
  await waitFor(() => mobile.evaluate('document.activeElement.closest(".thread-replies") && ' +
    'document.activeElement.textContent.includes("Great, I will present the results.") && ' + unread(0)),
    'Reading the reply alert did not open the nested reply');
  console.log('PASS: reply notification arrived live on mobile and highlighted the nested reply');

  const questionText = 'How do I update the FORA database on a new machine?';
  await desktop.command('Page.navigate', { url: origin + '/feed' });
  await waitFor(() => desktop.evaluate('location.pathname === "/feed" && !!document.querySelector("a[href=\'/questions\']")'), 'Q&A link missing from the feed');
  await desktop.evaluate('document.querySelector("a[href=\'/questions\']").click()');
  await waitFor(() => desktop.evaluate('location.pathname === "/questions" && !!document.querySelector(".composer-card select")'), 'Question composer did not open');
  await setValue(desktop, '.composer-card textarea', questionText);
  await desktop.evaluate('(() => { const select = document.querySelector(".composer-card select"); select.value = "sql-server"; select.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await click(desktop, '.composer-card button', 'Post question');
  const questionCard = '[...document.querySelectorAll(".post-card")].find(card => card.querySelector(".p-content")?.textContent === ' + JSON.stringify(questionText) + ')';
  await waitFor(() => desktop.evaluate('(' + questionCard + ')?.querySelector(".question-labels")?.textContent === "SQL ServerUnsolved"'),
    'Question did not appear under the selected topic as unsolved');
  const questionId = Number(await desktop.evaluate('(' + questionCard + ').dataset.postId'));
  console.log('PASS: posted an unsolved SQL Server question from the Q&A screen');

  const answerText = 'Set the connection string and JWT key, then run dotnet ef database update.';
  await mobile.command('Page.navigate', { url: origin + '/posts/' + questionId });
  await waitFor(() => mobile.evaluate('location.pathname === "/posts/' + questionId + '" && !!document.querySelector(".thread-composer textarea")'),
    'Question detail did not load on mobile');
  await setValue(mobile, '.thread-composer textarea', answerText);
  await click(mobile, '.thread-composer button', 'Post answer');
  await waitFor(() => mobile.evaluate('document.querySelector(".thread-root .thread-text")?.textContent === ' + JSON.stringify(answerText)), 'Answer did not appear');
  if (await mobile.evaluate('[...document.querySelectorAll(".thread-action")].some(button => button.textContent === "Accept answer")')) {
    throw new Error('A non-owner could see the acceptance action');
  }
  const answerId = await mobile.evaluate('document.querySelector(".thread-root article").id');
  await api(tokenA, '/comments', { postId: questionId, content: 'Remember to verify the database name first.' });
  await waitFor(() => desktop.evaluate(unread(1)), 'Question author did not receive the new answer notification');
  await desktop.evaluate('document.querySelector(".notifications-trigger").click()');
  await waitFor(() => desktop.evaluate('document.querySelector(".notification-item")?.textContent.includes("Lan commented on your post")'), 'Answer notification missing');
  await click(desktop, '.notification-item', 'Lan commented on your post');
  await waitFor(() => desktop.evaluate('document.activeElement.id === ' + JSON.stringify(answerId)), 'Answer notification did not open the answer');
  await click(desktop, '#' + answerId + ' .thread-action', 'Accept answer');
  await waitFor(() => desktop.evaluate('document.querySelector(".thread-root article")?.id === ' + JSON.stringify(answerId) +
    ' && !!document.querySelector(".thread-root .accepted-answer-label") && !!document.querySelector(".question-solved")'),
    'The accepted answer was not pinned and the question was not marked solved');
  console.log('PASS: question owner accepted an answer and pinned it above the newer answer');

  await waitFor(() => mobile.evaluate(unread(1)), 'Answer author did not receive an acceptance notification');
  await mobile.evaluate('document.querySelector(".notifications-trigger").click()');
  await waitFor(() => mobile.evaluate('document.querySelector(".notification-item")?.textContent.includes("Minh accepted your answer")'), 'Acceptance notification missing');
  await click(mobile, '.notification-item', 'Minh accepted your answer');
  await waitFor(() => mobile.evaluate('document.activeElement.id === ' + JSON.stringify(answerId) +
    ' && document.activeElement.classList.contains("accepted-answer") && ' + unread(0)),
    'Acceptance notification did not open and highlight the accepted answer');

  const questionOutput = resolve('.qa', 'question-ui');
  await mkdir(questionOutput, { recursive: true });
  if (await mobile.evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Question detail overflowed on mobile');
  const solutionCapture = await mobile.command('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(questionOutput, 'accepted-answer-mobile.png'), Buffer.from(solutionCapture.data, 'base64'));
  console.log('PASS: the acceptance notification arrived live and opened the pinned answer on mobile');

  await desktop.command('Page.navigate', { url: origin + '/questions' });
  await waitFor(() => desktop.evaluate('location.pathname === "/questions" && !!document.querySelector("[aria-label=\'Question filters\'] select")'), 'Question filters missing');
  await desktop.evaluate('(() => { const [topic, status] = document.querySelectorAll("[aria-label=\'Question filters\'] select"); topic.value = "sql-server"; topic.dispatchEvent(new Event("change", { bubbles: true })); status.value = "solved"; status.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await waitFor(() => desktop.evaluate('document.querySelector(".feed-grid")?.getAttribute("aria-busy") === "false" && !!(' + questionCard + ')?.querySelector(".question-solved")'),
    'The solved SQL Server question did not appear in the filters');
  const boardCapture = await desktop.command('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(questionOutput, 'solved-questions-desktop.png'), Buffer.from(boardCapture.data, 'base64'));
  await desktop.evaluate('(() => { const status = document.querySelectorAll("[aria-label=\'Question filters\'] select")[1]; status.value = "open"; status.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await waitFor(() => desktop.evaluate('document.querySelector(".feed-grid")?.getAttribute("aria-busy") === "false" && !(' + questionCard + ')'),
    'The solved question was still in the unsolved filter');
  console.log('PASS: topic, solved, and unsolved filters show the expected questions');

  const reactionPost = await api(tokenA, '/posts', { content: 'The SQL Server setup guide is ready for the team.' });
  const cardSelector = '[data-post-id="' + reactionPost.id + '"]';
  const reactionSelector = kind => cardSelector + ' [data-reaction="' + kind + '"]';
  const state = (kind, pressed, label) => '(() => { const button = document.querySelector(' +
    JSON.stringify(reactionSelector(kind)) + '); return button?.getAttribute("aria-pressed") === ' +
    JSON.stringify(String(pressed)) + ' && button.getAttribute("aria-label") === ' + JSON.stringify(label) + ' && !button.disabled; })()';
  const press = (page, kind) => page.evaluate('document.querySelector(' + JSON.stringify(reactionSelector(kind)) + ').click()');

  await desktop.command('Page.navigate', { url: origin + '/feed' });
  await waitFor(() => desktop.evaluate('location.pathname === "/feed" && ' + state('helpful', false, 'Helpful (0)')), 'Feed reactions missing');
  await press(desktop, 'helpful');
  await waitFor(() => desktop.evaluate(state('helpful', true, 'Helpful (1)')), 'Helpful reaction was not applied');
  await desktop.command('Page.reload');
  await waitFor(() => desktop.evaluate(state('helpful', true, 'Helpful (1)')), 'The reaction did not persist on reload');
  await press(desktop, 'funny');
  await waitFor(() => desktop.evaluate(state('funny', true, 'Funny (1)') + ' && ' + state('helpful', false, 'Helpful (0)')),
    'Switching reactions did not clear the old selection');
  await press(desktop, 'funny');
  await waitFor(() => desktop.evaluate(state('funny', false, 'Funny (0)')), 'Clicking the active reaction did not clear it');
  await press(desktop, 'helpful');
  await waitFor(() => desktop.evaluate(state('helpful', true, 'Helpful (1)')), 'Could not set Helpful again');
  console.log('PASS: chose, changed and removed a reaction from the desktop feed, including reload persistence');

  await mobile.command('Page.navigate', { url: origin + '/posts/' + reactionPost.id });
  await waitFor(() => mobile.evaluate('location.pathname === "/posts/' + reactionPost.id + '" && ' + state('helpful', false, 'Helpful (1)')),
    'Mobile detail did not show the other account’s Helpful reaction');
  await press(mobile, 'celebrate');
  await waitFor(() => mobile.evaluate(state('celebrate', true, 'Celebrate (1)') + ' && ' + state('helpful', false, 'Helpful (1)')),
    'Mobile detail did not show both accounts’ reactions');
  if (await mobile.evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('The mobile reaction bar overflowed');
  const reactionOutput = resolve('.qa', 'reaction-ui');
  await mkdir(reactionOutput, { recursive: true });
  const reactionCapture = await mobile.command('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(reactionOutput, 'mobile.png'), Buffer.from(reactionCapture.data, 'base64'));
  console.log('PASS: mobile detail shows separate counts and highlights the current viewer’s reaction');
} finally {
  socket?.close();
  browser.kill();
}
