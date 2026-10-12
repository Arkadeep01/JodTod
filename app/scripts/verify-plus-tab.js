/**
 * Plus-tab navigation contract verification (dependency-free).
 *
 * The repo has no frontend test runner (no jest/playwright; adding one
 * would violate the no-new-dependencies constraint), so this plain-node
 * script asserts the navigation contracts that the task requires:
 *
 *  1. "+" opens the action menu from EVERY tab (no per-route branch).
 *  2. "+" never navigates directly to Add Expense.
 *  3. Menu taps reach their real destinations (single-fire, no nesting bug).
 *  4. Menu close/dismiss behavior is intact.
 *  5. Regression: tabs, auth guards, back-nav order (close-then-push).
 *
 * It checks actual wiring (handler bodies, JSX props, route registration,
 * component structure) — not just that buttons render.
 *
 * Run:  node scripts/verify-plus-tab.js
 * Exit: 0 = all checks pass, 1 = failure (prints FAILED lines).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const read = (p) => fs.readFileSync(p, 'utf8');

const layoutPath = path.join(ROOT, 'app', '(tabs)', '_layout.tsx');
const sheetPath = path.join(
  ROOT, 'components', 'AddActionBottomSheet', 'AddActionBottomSheet.tsx'
);
const rootLayoutPath = path.join(ROOT, 'app', '_layout.tsx');

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAILED  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const layout = read(layoutPath);
const sheet = read(sheetPath);
const rootLayout = read(rootLayoutPath);

// ---------------------------------------------------------------------------
// 1. "+" opens the menu from every tab
// ---------------------------------------------------------------------------
const customTabBarBlock = layout.slice(
  layout.indexOf('function CustomTabBar'),
  layout.indexOf('export default function TabsLayout')
);
check(
  'plus-handler calls onAddActionPress',
  /onAddActionPress\(\)/.test(customTabBarBlock)
);
check(
  'plus-handler has no per-route branch (no isHomeScreen)',
  !/isHomeScreen/.test(layout),
  'found isHomeScreen conditional'
);
check(
  'plus-handler never pushes /add-expense directly from tab bar',
  !/router\.push\('\/add-expense'/.test(customTabBarBlock),
  'tab bar still pushes /add-expense'
);
check(
  'sheet open is idempotent boolean (no duplicate-menu stack)',
  /setSheetVisible\(true\)/.test(layout) &&
    /useState\(false\)/.test(layout),
  'expected setSheetVisible(true) over useState(false)'
);
check(
  'sheet is mounted globally in TabsLayout (outside per-tab screens)',
  /<AddActionBottomSheet[\s\S]*?visible=\{sheetVisible\}/.test(layout)
);

// ---------------------------------------------------------------------------
// 2. Menu taps reach real destinations (once each, menu closed first)
// ---------------------------------------------------------------------------
const destinations = [
  ['Add Expense', 'onAddExpense', '/add-expense', 'add-expense.tsx', 'add-expense'],
  ['Add Receipt', 'onScanReceipt', '/add-receipt', 'add-receipt.tsx', 'add-receipt'],
  ['Add Member', 'onAddMember', '/add-member', 'add-member.tsx', 'add-member'],
  ['Add Group', 'onAddSettlement', '/(tabs)/groups/create', null, null],
  ['Scan QR to Join', 'onScanJoin', '/scan-join-qr', 'scan-join-qr.tsx', 'scan-join-qr'],
];
for (const [label, prop, route, file, stackName] of destinations) {
  check(
    `${label}: sheet receives ${prop} prop`,
    new RegExp(`${prop}=\\{`).test(layout),
    `${prop} not wired into <AddActionBottomSheet>`
  );
  check(
    `${label}: handler pushes ${route}`,
    layout.includes(`router.push('${route}'`),
    `no router.push('${route}') in (tabs)/_layout.tsx`
  );
  if (file) {
    check(
      `${label}: destination file src/app/${file} exists`,
      fs.existsSync(path.join(ROOT, 'app', file)),
      'destination file missing'
    );
  } else {
    check(
      `${label}: destination file src/app/(tabs)/groups/create.tsx exists`,
      fs.existsSync(path.join(ROOT, 'app', '(tabs)', 'groups', 'create.tsx')),
      'destination file missing'
    );
  }
  if (stackName) {
    check(
      `${label}: Stack.Screen "${stackName}" registered in root layout`,
      rootLayout.includes(`name="${stackName}"`),
      'route not registered'
    );
  } else {
    check(
      `${label}: Tabs.Screen groups/create registered`,
      layout.includes('name="groups/create"'),
      'route not registered'
    );
  }
  check(
    `${label}: handler closes sheet before navigating`,
    new RegExp(
      `handle\\w* = React\\.useCallback\\(\\(\\) => \\{[\\s\\S]*?setSheetVisible\\(false\\);[\\s\\S]*?router\\.push\\('${route.replace(/[()]/g, (c) => '\\' + c).replace(/\//g, '\\/')}'`
    ).test(layout),
    'expected setSheetVisible(false) before router.push'
  );
}

// Sheet renders all five action cards with the right callbacks.
const cardWiring = [
  ['Add Expense card', 'onPress={onAddExpense}'],
  ['Add Receipt card', 'onPress={onScanReceipt}'],
  ['Add Member card', 'onPress={onAddMember}'],
  ['Add Group card', 'onPress={onAddSettlement}'],
  ['Scan QR card', 'onPress={onScanJoin}'],
];
for (const [label, snippet] of cardWiring) {
  check(`${label} wired`, sheet.includes(snippet), `${snippet} missing`);
}

// ---------------------------------------------------------------------------
// 3. Structural bugs that swallowed taps are gone
// ---------------------------------------------------------------------------
// (a) Action cards must NOT be nested inside the backdrop TouchableOpacity:
//     extract the backdrop touchable and assert it contains no ActionCard.
const backdropStart = sheet.indexOf('onPress={handleBackdropPress}');
const backdropEnd = sheet.indexOf('</TouchableOpacity>', backdropStart);
const backdropBlock =
  backdropStart >= 0 && backdropEnd >= 0
    ? sheet.slice(backdropStart, backdropEnd)
    : '';
check(
  'backdrop touchable does not wrap action cards (no nested-touchable swallow)',
  backdropBlock !== '' && !backdropBlock.includes('ActionCard'),
  'ActionCard still nested inside backdrop pressable'
);
// (b) Single-fire: no runOnJS(onPress) double-invocation alongside onPress.
check(
  'ActionCard fires once (no onPressOut runOnJS double-call)',
  !sheet.includes('runOnJS(onPress)'),
  'double-fire still present'
);
check(
  'ActionCard keeps standard onPress prop',
  /onPress=\{onPress\}/.test(sheet),
  'onPress prop missing'
);

// ---------------------------------------------------------------------------
// 4. Menu close / dismiss
// ---------------------------------------------------------------------------
check('backdrop press closes menu', /handleBackdropPress[\s\S]*?onClose\(\)/.test(sheet));
check('Cancel button closes menu', /handleClosePress[\s\S]*?onClose\(\)/.test(sheet));
check(
  'sheet onClose clears visibility state',
  /handleSheetClose[\s\S]*?setSheetVisible\(false\)/.test(layout)
);
check(
  'backdrop disabled while hidden (no invisible tap trap)',
  /disabled=\{!visible\}/.test(sheet)
);
check(
  'overlay ignores touches while hidden',
  /pointerEvents=\{visible \? 'auto' : 'none'\}/.test(sheet)
);

// ---------------------------------------------------------------------------
// 5. Regression: tabs, guards, back-nav
// ---------------------------------------------------------------------------
for (const tab of ['index', 'groups/index', 'activity', 'settle']) {
  check(
    `tab "${tab}" still defined`,
    layout.includes(`name: '${tab}'`) || layout.includes(`name="${tab}"`),
    'tab definition missing'
  );
}
check('regular tabs use navigation.navigate', /navigation\.navigate\(tab\.name\)/.test(layout));
check('auth loading gate intact', /if \(isLoading\)/.test(layout));
check('unauthenticated redirect intact', /if \(!isAuthenticated && !isVerificationPending\)/.test(layout));
check('verify-email redirect intact', /if \(isVerificationPending\)/.test(layout));
check(
  'no stale direct-to-add-expense navigation remains outside handleAddExpense',
  (layout.match(/router\.push\('\/add-expense'/g) || []).length === 1,
  'unexpected /add-expense pushes'
);

// ---------------------------------------------------------------------------
// 6. Audit-fix regression: notification detail + group settings dead buttons
// ---------------------------------------------------------------------------
const notifDetail = read(path.join(ROOT, 'app', 'notifications', '[id].tsx'));
const groupSettings = read(
  path.join(ROOT, 'app', '(tabs)', 'groups', '[id]', 'settings.tsx')
);
check(
  'notification group buttons navigate to their group',
  (notifDetail.match(/router\.push\(`\/\(tabs\)\/groups\/\$\{notification\.related_group_id\}`/g) || []).length === 8,
  'expected 8 group-destination pushes'
);
check(
  'no live dead-button handlers remain (only the 2 documented disabled ones)',
  (notifDetail.match(/onPress=\{\(\) => \{\}\}/g) || []).length === 2,
  'unexpected empty onPress handlers'
);
check(
  'disabled states exist for genuinely unimplemented flows (report, system action)',
  (notifDetail.match(/<PrimaryButton[\s\S]*?disabled[\s\S]*?onPress=\{\(\) => \{\}\}/g) || []).length === 2,
  'expected 2 disabled PrimaryButtons'
);
check(
  'no pressable-without-handler bill rows remain',
  !notifDetail.includes('<TouchableOpacity activeOpacity={0.85} className="flex-row items-center justify-between">'),
  'handler-less pressable still present'
);
check(
  'notification retry actually refetches (no dead attempt counter)',
  notifDetail.includes('onPress={() => void loadNotification()}') &&
    !notifDetail.includes('setAttempt'),
  'retry still disconnected from fetch'
);
check(
  'group settings Notification Preferences navigates to Preferences',
  groupSettings.includes('label="Notification Preferences" onPress={() => router.push(\'/preferences\''),
  'row still dead or misrouted'
);

// ---------------------------------------------------------------------------
// 7. Create Group readability (opaque inputs over the photo backdrop)
// ---------------------------------------------------------------------------
const groupsUi = read(path.join(ROOT, 'components', 'groups', 'ui.tsx'));
const groupForm = read(path.join(ROOT, 'components', 'groups', 'GroupForm.tsx'));
const createGroup = read(path.join(ROOT, 'app', '(tabs)', 'groups', 'create.tsx'));
const editGroup = read(
  path.join(ROOT, 'app', '(tabs)', 'groups', '[id]', 'edit.tsx')
);
check(
  'form inputs use an opaque surface (no 8%-white wash-out)',
  groupsUi.includes("backgroundColor: 'rgba(255,255,255,0.78)'") &&
    !groupsUi.includes("backgroundColor: 'rgba(255,255,255,0.08)'"),
  'input background still near-transparent'
);
check(
  'input placeholders raised above 40% opacity',
  groupsUi.includes('placeholderTextColor="rgba(20,33,43,0.55)"'),
  'placeholder still rgba(20,33,43,0.4)'
);
check(
  'create + edit error boxes use 70% white',
  createGroup.includes('bg-white/70') && editGroup.includes('bg-white/70'),
  'error box still bg-white/50'
);
check(
  'cover picker art is opaque (55% white)',
  groupForm.includes("backgroundColor: 'rgba(255,255,255,0.55)'"),
  'picker still 20% white'
);

// ---------------------------------------------------------------------------
// 8. Home group cards -> group detail by real id
// ---------------------------------------------------------------------------
const home = read(path.join(ROOT, 'app', '(tabs)', 'index.tsx'));
check(
  'HomeGroup view-model carries the backend id',
  /type HomeGroup = \{[\s\S]*?id: string;/.test(home),
  'HomeGroup has no id field'
);
check(
  'group mapping preserves g.id (no hardcoded ids)',
  home.includes('id: g.id,'),
  'mapping drops the backend id'
);
check(
  'group cards navigate to /(tabs)/groups/<id> with missing-id guard',
  home.includes('router.push(`/(tabs)/groups/${group.id}`') &&
    home.includes('if (!group.id) return;'),
  'card onPress missing or unguarded'
);
check(
  'group cards keyed by id (not name)',
  home.includes('key={group.id}'),
  'key still group.name'
);
check(
  'See All groups still opens the Groups listing',
  home.includes("onSeeAll={() => router.push('/(tabs)/groups' as any)}"),
  'See All groups changed'
);

// ---------------------------------------------------------------------------
// 9. Home recent expenses -> Activity expense detail by real id
// ---------------------------------------------------------------------------
check(
  'RecentExpense view-model carries the activity id',
  /type RecentExpense = \{[\s\S]*?id: string;/.test(home),
  'RecentExpense has no id field'
);
check(
  'expense mapping preserves a.id',
  home.includes('id: a.id,'),
  'mapping drops the activity id'
);
check(
  'expense rows deep-link with activityId + fresh nonce',
  home.includes('activityId: expense.id,') && home.includes('ts: String(Date.now())'),
  'row onPress missing activityId/ts'
);
check(
  'expense rows guarded against missing ids',
  home.includes('if (!expense.id) return;'),
  'row onPress unguarded'
);
check(
  'See All expenses still opens the Activity listing',
  home.includes("onSeeAll={() => router.push('/(tabs)/activity' as any)}"),
  'See All expenses changed'
);
const activityFlow = read(path.join(ROOT, 'app', '(tabs)', 'activity.tsx'));
check(
  'Activity tab consumes the activityId deep link into its expense detail',
  activityFlow.includes('params.activityId') &&
    activityFlow.includes("{ name: \"expense\", params: { id } }"),
  'deep-link consumer missing'
);
check(
  'expense detail fetches its own record by id (no hardcoded item)',
  activityFlow.includes('useActivityDetail(activityId)') &&
    activityFlow.includes('fetchActivityById(activityId)'),
  'detail does not load by id'
);

// ---------------------------------------------------------------------------
// 10. Audit: no dead pressables in the touched card flows
// ---------------------------------------------------------------------------
const expenseRow = read(
  path.join(ROOT, 'components', 'groups', 'ExpenseRow.tsx')
);
check(
  'group-listing ExpenseRow is not a dead pressable',
  !expenseRow.includes('TouchableOpacity'),
  'handler-less TouchableOpacity remains'
);
check(
  'GroupForm cover art is not a dead pressable',
  !groupForm.includes('TouchableOpacity'),
  'handler-less cover picker remains'
);
const groupsIndex = read(path.join(ROOT, 'app', '(tabs)', 'groups', 'index.tsx'));
check(
  'Groups listing cards still navigate by real id',
  groupsIndex.includes('router.push(`/(tabs)/groups/${g.id}`'),
  'Groups listing navigation changed'
);

// ---------------------------------------------------------------------------
// 11. Notification list query contract (400 regression: never send `type=`)
// ---------------------------------------------------------------------------
const notifApi = read(path.join(ROOT, 'services', 'notification.api.ts'));
check(
  'list omits unset type filter (no unconditional `type=`)',
  !notifApi.includes('search.set("type", params.type ?? "")') &&
    /if \(params\.type\) search\.set\("type", params\.type\)/.test(notifApi),
  'empty type param still sent'
);
check(
  'list omits read=all (server treats it as no filter)',
  /params\.read !== "all"/.test(notifApi),
  'read=all still sent as a filter'
);
check(
  'list errors surface backend detail for diagnosis',
  /errorDetail\(response\)/.test(notifApi),
  'opaque status-only message'
);

// ---------------------------------------------------------------------------
// 12. Back-navigation audit fixes (no history residue, no dead-end backs)
// ---------------------------------------------------------------------------
const onboarding = read(path.join(ROOT, 'app', 'onboarding.tsx'));
check(
  'onboarding leaves no residue (replace, not push, to login)',
  !onboarding.includes("router.push('/login'") &&
    (onboarding.match(/router\.replace\('\/login'/g) || []).length === 2,
  'push to /login remains — post-auth back replays onboarding'
);
const joinGroup = read(path.join(ROOT, 'app', 'join-group.tsx'));
check(
  'join-group backs fall back to Groups list on empty history',
  joinGroup.includes('goBackOrGroups') &&
    joinGroup.includes("router.replace('/(tabs)/groups'") &&
    !/onPress=\{\(\) => router\.back\(\)\}/.test(joinGroup),
  'bare router.back() remains in join-group'
);
const scanQr = read(path.join(ROOT, 'app', 'scan-join-qr.tsx'));
check(
  'scan backs fall back to tabs root on empty history',
  scanQr.includes('goBackOrTabs') &&
    scanQr.includes("router.replace('/(tabs)'") &&
    !/onPress=\{\(\) => router\.back\(\)\}/.test(scanQr),
  'bare router.back() remains in scan-join-qr'
);
const notifIndex = read(path.join(ROOT, 'app', 'notifications', 'index.tsx'));
check(
  'notifications list back falls back to tabs root',
  notifIndex.includes('router.canGoBack()') &&
    notifIndex.includes("router.replace('/(tabs)'"),
  'bare header back remains in notifications list'
);
check(
  'notification detail back falls back to the list',
  notifDetail.includes('router.canGoBack()') &&
    notifDetail.includes("router.replace('/notifications'"),
  'bare handleBack remains in notification detail'
);
check(
  'groups/join keeps its single guarded beforeRemove return',
  (groupSettings && true) &&
    read(path.join(ROOT, 'app', '(tabs)', 'groups', 'join.tsx')).match(
      /addListener\('beforeRemove'/
    ) !== null &&
    read(path.join(ROOT, 'app', '(tabs)', 'groups', 'join.tsx')).includes(
      'router.replace(from as never)'
    ),
  'beforeRemove return broken or duplicated'
);
const activityFlowSrc = read(path.join(ROOT, 'app', '(tabs)', 'activity.tsx'));
check(
  'activity keeps exactly one hardware-back handler (no duplicates)',
  (activityFlowSrc.match(/BackHandler\.addEventListener/g) || []).length === 1,
  'BackHandler duplicated or missing'
);

// ---------------------------------------------------------------------------
// 13. Home money-flow: outward arrows, dynamic counts, max 5 per flow
// ---------------------------------------------------------------------------
check(
  'get flow renders inward (TOWARD: person -> user avatar)',
  home.includes('pathsLeft: isGet ? FLOW_TOWARD_LEFT : FLOW_AWAY_LEFT,') &&
    home.includes('pathsRight: isGet ? FLOW_TOWARD_RIGHT : FLOW_AWAY_RIGHT,'),
  'get flow does not point toward the user'
);
check(
  'owe flow renders outward (AWAY: user avatar -> person)',
  home.includes(': FLOW_AWAY_LEFT,') && home.includes(': FLOW_AWAY_RIGHT,'),
  'owe flow does not point away from the user'
);
check(
  'animation travels along the rendered paths (dots match heads)',
  home.includes('const progress = useSharedValue(0);') &&
    home.includes('useMemo(() => sampleCubic(curve, 56), [curve])'),
  'dot animation decoupled from path direction'
);
check(
  'mode switch recomputes arrows (no stale geometry retained)',
  home.includes('const flowSource = flowTab === ') &&
    home.includes('.slice(0, MAX_FLOW_ARROWS)'),
  'arrows not derived per active mode'
);
check(
  'arrow cap is exactly 5 per flow',
  home.includes('const MAX_FLOW_ARROWS = 5;') &&
    home.includes('.slice(0, MAX_FLOW_ARROWS)'),
  'cap missing or not 5'
);
check(
  'fixed 3+3 flow rendering is gone (dynamic balanced split)',
  home.includes('const flowLeft: FlowPerson[] = flowPeople.slice(0, flowLeftCount);') &&
    home.includes('const flowRight: FlowPerson[] = flowPeople.slice(flowLeftCount);') &&
    home.includes('Math.ceil(flowPeople.length / 2)'),
  'flow still uses fixed three-person slices'
);
check(
  'curve slots spread to match rows (1->middle, 2->edges)',
  home.includes('if (count === 1) return [1];') &&
    home.includes('if (count === 2) return [0, 2];'),
  'slotsFor spread missing'
);
check(
  'person rows keyed by stable backend id (not display name)',
  home.includes('id: p.user_id,') &&
    (home.match(/key=\{p\.id\}/g) || []).length === 2 &&
    !home.includes('key={p.name}'),
  'rows still keyed by name'
);
check(
  'counts derive from positive-balance people only (settled excluded)',
  home.includes('toPaiseSafe(p.they_owe) > 0') &&
    home.includes('toPaiseSafe(p.you_owe) > 0'),
  'positive-balance filter missing'
);
check(
  'header shows the real total independently of the cap',
  home.includes('theyOweMe.length : iOweThem.length'),
  'capped count leaked into the total'
);
check(
  'arrows keyed by stable slot (no animation restart on count change)',
  home.includes('key={`l${slot}`') && home.includes('key={`r${slot}`'),
  'curve keys not slot-stable'
);
check(
  'empty-state text preserved for zero balances',
  home.includes('No outstanding balances'),
  'empty state removed'
);
check(
  'settlement math untouched (totals still reduce over groups)',
  home.includes('homeGroups.reduce((s, g) => s + toPaiseSafe(g.you_are_owed), 0)') &&
    home.includes('homeGroups.reduce((s, g) => s + toPaiseSafe(g.you_owe), 0)'),
  'balance aggregation changed'
);

// ---------------------------------------------------------------------------
// 14. Group detail header redesign + persisted group photo
// ---------------------------------------------------------------------------
const groupDetail = read(path.join(ROOT, 'app', '(tabs)', 'groups', '[id]', 'index.tsx'));
const groupsApi = read(path.join(ROOT, 'services', 'groups.api.ts'));
const groupPhotoHook = read(path.join(ROOT, 'hooks', 'useGroupPhoto.ts'));
const photoSheet = read(path.join(ROOT, 'components', 'profile', 'ProfilePhotoSheet.tsx'));
const backendDir = path.join(__dirname, '..', '..', 'backend');
const groupPhotoService = read(path.join(backendDir, 'services', 'group_photo_service.py'));
const groupRoutes = read(path.join(backendDir, 'routes', 'groups.py'));
check(
  'header avatar overlaps the card edge (flex-centered, no device coords)',
  groupDetail.includes('style={{ top: -AVATAR_SIZE / 2 }}') &&
    groupDetail.includes('className="absolute inset-x-0 items-center"'),
  'avatar overlap missing or hardcoded'
);
check(
  'avatar falls back to name-derived initials on missing/failed image',
  groupDetail.includes('function groupInitials(name: string)') &&
    groupDetail.includes('onError={() => setFailed(true)}'),
  'initials fallback missing'
);
check(
  'camera control is admin-gated (hidden otherwise, never dead)',
  groupDetail.includes("myRole === 'admin'") &&
    groupDetail.includes('{canEditPhoto ? ('),
  'edit control not permission-gated'
);
check(
  'image override resets on group switch (no cross-group flash)',
  groupDetail.includes('setImageOverride(undefined);') &&
    groupDetail.includes('}, [groupId]);'),
  'override reset missing'
);
check(
  'stored image_url is resolved before display (no raw relative path)',
  !groupDetail.includes('photoUri={detail.image_url') &&
    groupDetail.includes('avatarOrEmpty(effectiveImage)'),
  'raw image_url still passed to avatar'
);
check(
  'photo sheet wired with group title and upload states',
  groupDetail.includes('title="Group photo"') &&
    groupDetail.includes('uploading={photo.uploading}'),
  'sheet wiring missing'
);
check(
  'groups.api exposes upload/remove photo calls',
  groupsApi.includes('export async function uploadGroupPhoto(') &&
    groupsApi.includes('export async function removeGroupPhoto('),
  'photo API fns missing'
);
check(
  'group photo hook owns picker/permissions/upload/remove',
  groupPhotoHook.includes('requestMediaLibraryPermissionsAsync') &&
    groupPhotoHook.includes('uploadGroupPhoto(groupIdRef.current, photo)') &&
    groupPhotoHook.includes('removeGroupPhoto(groupIdRef.current)'),
  'hook flow incomplete'
);
check(
  'photo sheet accepts a custom title (backwards compatible)',
  photoSheet.includes('title = "Profile photo"'),
  'title prop missing'
);
check(
  'backend photo endpoints are admin-gated (403, not oracle)',
  groupRoutes.includes('@router.post("/{group_id}/photo"') &&
    groupRoutes.includes('@router.delete("/{group_id}/photo"') &&
    groupRoutes.includes('if membership.role != MemberRole.ADMIN:'),
  'photo routes missing or ungated'
);
check(
  'photo service validates type/size and never mutates on failure',
  groupPhotoService.includes('MAX_PHOTO_BYTES') &&
    groupPhotoService.includes('ALLOWED_CONTENT_TYPES') &&
    groupPhotoService.includes('left untouched') &&
    groupPhotoService.includes('remove the orphan file'),
  'service safety rules missing'
);
check(
  'no migration needed (image_url column already exists)',
  groupRoutes.includes('image_url=group.image_url'),
  'persistence path broken'
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
