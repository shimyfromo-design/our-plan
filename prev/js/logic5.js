/*
 * Our Plan — Round 5 shared pure logic (extends OurPlanLogic; no I/O, no clocks).
 * Runs unchanged in the browser (after logic4.js), in Apps Script (concatenated into Code.gs after logic4.js) and in Node
 * tests (require('./logic5.js') returns the extended logic object).
 * Builds docs/round5-program.md: the 4 am day, the 12-week program (moves, ladders, workouts, blocks, effort and moving up,
 * "where did you feel it", pain swaps, days that don't go to plan, timing), her version, walking, and the voice lines.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./logic4.js'), require('./content.js')); }
  else { factory(root.OurPlanLogic, root.OurPlanContent); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L, K) {
  'use strict';

  // ============================================================= the 4 am day (spec 3.1)
  /** The day a log belongs to: before 4:00 am New York time it still counts for the day before. */
  var DAY_ENDS = 4 * 60;
  function appDay(t) {
    var n = L.ny(t == null ? new Date() : t);
    if (!n) return '';
    return n.minutes < DAY_ENDS ? L.addDays(n.date, -1) : n.date;
  }
  /** "Still Sunday until 4 am" between midnight and 4 am, else ''. */
  function stillLine(t) {
    var n = L.ny(t == null ? new Date() : t);
    if (!n || n.minutes >= DAY_ENDS) return '';
    return 'Still ' + L.WEEKDAYS[L.weekday(L.addDays(n.date, -1))] + ' until 4 am';
  }

  // ============================================================= the moves (program parts 2, 3, 5, 6; spec section 5)
  var V = function (id, ch, start, backup, bch, bstart) { return { id: id, channel: ch, start: start || 0, backup: backup ? { id: backup, channel: bch || '', start: bstart || 0 } : null }; };
  /** Region for her symptom gate: lower-body and core moves get one rung easier after "Something felt off". */
  var MOVES = {
    box_squat: {
      name: 'Goblet box squat', first: 'Box squat to a chair', slot: 'Knee', region: 'lower', ladder: 'boxSquat', range: [10, 15], dir: 'lower', finding: false, kind: 'squat',
      setup: 'A sturdy chair against the wall behind you, feet hip-width.',
      points: ['Sit back to the chair slowly, three seconds down.', 'Touch the chair without relaxing, chest up.', 'Push the floor away and stand tall.'],
      squeeze: 'Push the floor away', swap: 'box_squat:1',
      video: V('akAhLxnS9aI', 'Dr. Carl Baird, DC', 0, 'D1IEI-lfLxU', 'Ascend Physical Therapy'), video2: V('D1IEI-lfLxU', 'Ascend Physical Therapy', 0, 'byka1jt3YXA', 'MarkBroadbentPT')
    },
    squat15: {
      name: 'Goblet 1½-rep squat', slot: 'Knee', region: 'lower', ladder: 'squat15', range: [10, 15], dir: 'lower', finding: false, kind: 'squat', harderOf: 'box_squat',
      setup: 'Dumbbell held at your chest like a cup, feet hip-width.',
      points: ['All the way down, then halfway up.', 'Back down to the bottom, then all the way up. That is one rep.', 'Chest up, weight in the middle of your feet.'],
      squeeze: 'Push the floor away', swap: 'box_squat:1',
      video: V('Mpetb-KgV8Y', 'The Barbell Physio (Dr. Zach Long, DPT)', 0, 'A6oRqgTn7fI', 'Alex Bunt')
    },
    split_squat: {
      name: 'Split squat', slot: 'Knee', region: 'lower', ladder: 'split', range: [8, 12], side: true, dir: 'lower', finding: false, kind: 'split',
      setup: 'A long step, back heel up, hand on the wall if you need it.',
      points: ['Back knee drops straight down, like an elevator.', 'Front knee follows your middle toes.', 'Push through the front heel to come up.'],
      squeeze: 'Push through the front heel', swap: 'box_squat:1',
      video: V('SFdTsYf7_MU', 'Mike Robertson, MS', 0, '4bNQITw0VdY', 'E3 Rehab (DPTs)', 69)
    },
    rfess: {
      name: 'Rear-foot-elevated split squat', slot: 'Knee', region: 'lower', ladder: 'split', range: [8, 12], side: true, dir: 'lower', finding: false, kind: 'split', harderOf: 'split_squat', herGate: true,
      setup: 'Back foot resting on the couch seat or the bottom stair.',
      points: ['Back foot just rests. The front leg does the work.', 'Drop the back knee straight down.', 'Push through the front heel to stand.'],
      squeeze: 'Push through the front heel', swap: 'box_squat:1',
      video: V('-4LVK1crLSw', 'Squat University (Dr. Aaron Horschig, PT)', 0, '4bNQITw0VdY', 'E3 Rehab (DPTs)', 208)
    },
    hinge_drill: {
      name: 'Hinge drill', slot: 'Hip', region: 'lower', ladder: 'hinge', range: [8, 12], dir: 'lower', finding: false, kind: 'hinge', drill: true,
      setup: 'Stand a foot from a wall, back to it. Later, a broomstick along your back.',
      points: ['Soft knees. Push your hips back, like closing a car door with your butt.', 'With the stick: it touches your head, mid-back and tailbone the whole time.', 'Stop when the backs of your thighs feel tight, then stand tall.'],
      squeeze: 'Squeeze your butt at the top', swap: 'bridge:1',
      video: V('mg35BfA-0ZM', 'LeBauer Physical Therapy', 0, 'wyop1jrpG18', 'Dr. Carl Baird, DC')
    },
    pull_through: {
      name: 'Band pull-through', slot: 'Hip', region: 'lower', ladder: 'band', range: [10, 15], dir: 'lower', finding: false, kind: 'hinge', anchor: 'low',
      setup: 'Anchor low, face away from the door, band between your legs.',
      points: ['Walk out until the band is just tight.', 'Hips back, like closing a car door with your butt.', 'Squeeze your butt to stand tall. Don\'t lean back.'],
      squeeze: 'Squeeze your butt at the top', swap: 'hinge_drill:2',
      video: V('W3eVIaLUuHk', 'Fit2Go') // its backup can't be embedded (oEmbed 401 on Oct 20): no backup
    },
    db_rdl: {
      name: 'Dumbbell RDL', slot: 'Hip', region: 'lower', ladder: 'rdl', range: [10, 15], dir: 'lower', finding: false, kind: 'hinge',
      setup: 'A dumbbell in each hand, feet hip-width, soft knees.',
      points: ['Push your hips back. The dumbbells slide down your thighs.', 'Shins stay straight up and down.', 'Stop when you feel the stretch, then squeeze your butt to stand.'],
      squeeze: 'Squeeze your butt at the top', swap: 'hinge_drill:2',
      video: V('hQgFixeXdZo', 'J2FIT (Mike Dewar)', 0, 'uhghy9pFIPY', 'E3 Rehab (DPTs)', 82)
    },
    bstance_rdl: {
      name: 'B-stance RDL', slot: 'Hip', region: 'lower', ladder: 'bstance', range: [8, 12], side: true, dir: 'lower', finding: false, kind: 'hinge', harderOf: 'db_rdl',
      setup: 'Kickstand stance: back foot\'s toes down, most of your weight on the front leg.',
      points: ['About 80% of your weight on the front leg.', 'Hips back, shin straight, soft knee.', 'Stand tall with a squeeze. Then switch sides.'],
      squeeze: 'Squeeze your butt at the top', swap: 'hinge_drill:2',
      video: V('Th4QdA2BOyg', 'J2FIT (Mike Dewar)', 0, 'WOal21Uk6CU', 'Physical Therapy First')
    },
    bridge: {
      name: 'Hip thrust', first: 'Glute bridge with loop band', slot: 'Hip', region: 'lower', ladder: 'bridge', range: [10, 15], dir: 'up', finding: false, kind: 'bridge',
      setup: 'Loop band just above your knees, knees pressed out to hip width.',
      points: ['Feet flat, heels a little in front of your knees.', 'Lift with your hips, not your back. Stop in a straight line.', 'Squeeze your butt at the top, then lower slowly.'],
      squeeze: 'Squeeze your butt at the top', swap: 'bridge:1',
      video: V('1vgjDZ9SZr4', 'LeBauer Physical Therapy', 0, '2_Z61SwEuWw', 'Dr. Carl Baird, DC'), video2: V('29OfN4ztW_g', 'J2FIT', 0, 'UmY5lVwpycE', 'Dr. Carl Baird, DC')
    },
    sl_hip_thrust: {
      name: 'Single-leg hip thrust', slot: 'Hip', region: 'lower', ladder: 'slThrust', range: [8, 12], side: true, dir: 'up', finding: false, kind: 'bridge', harderOf: 'bridge', herGate: true,
      setup: 'Shoulders on the couch seat, one foot on the floor. No loop band.',
      points: ['Push through the heel of the working leg.', 'Hips up to a straight line, ribs down.', 'Lower slowly, then switch sides.'],
      squeeze: 'Squeeze your butt at the top', swap: 'bridge:1',
      video: V('J3qfu-rQgus', 'The Barbell Physio (Dr. Zach Long, DPT)', 0, 'b8lu0MK34uA', 'OPEX Fitness')
    },
    pushup: {
      name: 'Incline push-up', slot: 'Push', region: 'upper', ladder: 'pushup', range: [8, 15], dir: 'lower', finding: false, kind: 'push',
      setup: 'Hands on the wall, counter or chair, a little wider than your shoulders.',
      points: ['One straight line from head to heels.', 'Elbows at about 45 degrees, like an arrow, not a T.', 'Lower for three seconds, then push the wall away.'],
      squeeze: 'Push the wall away', swap: 'pushup:1',
      video: V('QGCW-jL1O4s', 'Physio REHAB', 0, 'vPojzSvc-58', 'Ability Rehabilitation (DPT)')
    },
    band_row: {
      name: 'Band row', slot: 'Pull', region: 'upper', ladder: 'band', range: [10, 15], dir: 'pull', finding: true, kind: 'row', anchor: 'chest',
      setup: 'Anchor at chest height, a handle in each hand, stand tall.',
      points: ['Start by pulling your shoulder blades back.', 'Elbows lead, close to your sides.', 'Return slowly for three seconds.'],
      squeeze: 'Pinch a pencil between your shoulder blades', swap: 'rung:-1',
      video: V('9TOlWwzyjYw', 'Vive Health', 0, 'nnAt37a46Kg', 'Fit2Go')
    },
    pulldown: {
      name: 'Kneeling band pulldown', slot: 'Pull', region: 'upper', ladder: 'band', range: [10, 15], dir: 'pull', finding: true, kind: 'row', anchor: 'top', kneel: true,
      setup: 'Anchor at the top of the door. Kneel facing it, arms up.',
      points: ['Shoulders down before you pull.', 'Pull your elbows down to your back pockets.', 'Let the arms rise slowly for three seconds.'],
      squeeze: 'Pinch a pencil between your shoulder blades', swap: 'rung:-1',
      video: V('gebMl23Fw_4', 'Rehab My Patient', 0, '07d6EYJH9lQ', 'Bob & Brad (PTs)', 635)
    },
    face_pull: {
      name: 'Band face pull', slot: 'Shoulders', region: 'upper', ladder: 'band', range: [10, 15], dir: 'pull', finding: true, kind: 'row', anchor: 'top',
      setup: 'Anchor at the top, thumbs pointing back.',
      points: ['Shoulders down, away from your ears.', 'Pull to your eyebrows, elbows high.', 'Return slowly for three seconds.'],
      squeeze: 'Pinch a pencil between your shoulder blades', swap: 'rung:-1',
      video: V('H8oCtCv0dtI', 'Movement Project PT', 0, 'PYj77in44ms', 'Horton Barbell')
    },
    chest_press: {
      name: 'Band chest press', slot: 'Push', region: 'upper', ladder: 'band', range: [10, 15], dir: 'push', finding: true, kind: 'press', anchor: 'chest',
      setup: 'Anchor at chest height, face away from the door, split stance.',
      points: ['Hands at chest height, elbows at 45 degrees.', 'Press straight out without leaning in.', 'Return slowly for three seconds. Ribs down.'],
      squeeze: 'Push the wall away', swap: 'rung:-1',
      video: V('9NGo4lZd65o', 'RADCENTRE', 0, 'oQpnL60ptmU', 'Fit2Go')
    },
    seated_press: {
      name: 'Seated band press', slot: 'Shoulders', region: 'upper', ladder: 'press', range: [10, 15], dir: 'push', finding: true, kind: 'ohp',
      setup: 'Sturdy chair against a wall, shoes on, feet on the middle of the band.',
      points: ['Back against the chair, ribs down.', 'Shoulders down at the start, then press up beside your head.', 'Lower slowly for three seconds.'],
      squeeze: 'Punch the ceiling', swap: 'rung:-1',
      video: V('lsce2Wf887c', 'Fitway', 0, 'VWPt17BXiFU', 'Rehab My Patient'), flag: true
    },
    pallof: {
      name: 'Pallof press', slot: 'Core', region: 'core', ladder: 'band', range: [6, 10], side: true, dir: 'pallof', finding: true, kind: 'pallof', anchor: 'chest',
      setup: 'Sideways to the door, both band ends on one ankle strap, held in both hands.',
      points: ['Half-kneeling, hands at your breastbone.', 'Press straight out and hold. Don\'t let the band turn you.', 'Breathe out as you press. Then switch sides.'],
      squeeze: 'Don\'t let the band turn you', swap: 'rung:-1',
      video: V('axgv7H_VQOo', 'BarBend (Steve Horney, DPT)', 0, '3-2uxtBmznI', 'Physical Therapy & Hand Clinic of Hillsboro'),
      herVideo: V('XwlqulOzMCY', 'BodyFabulous')
    },
    dead_bug: {
      name: 'Dead bug', slot: 'Core', region: 'core', ladder: 'deadBug', range: [6, 10], side: true, dir: 'reach', finding: false, kind: 'core',
      setup: 'On your back, knees up over your hips, low back on the floor.',
      points: ['Keep your low back on the floor the whole time.', 'Reach slowly and breathe out as you reach.', 'Don\'t reach as far if your back lifts.'],
      squeeze: 'Breathe out as you reach', swap: 'dead_bug:1',
      video: V('8NBNM8haZx0', 'ChoosePT / APTA (Dr. Robert Gillanders, DPT)', 0, 'wZ9iVzcwgGM', 'Dr. Carl Baird, DC', 102),
      herVideo: V('Ct9LUMViz7g', 'Pro Physio (Jill Sippos, PT)', 0, 'g_BYB0R-4Ws', 'Children\'s Hospital Colorado')
    },
    curl: {
      name: 'Dumbbell curl', slot: 'Arms', region: 'upper', ladder: 'curl', range: [10, 15], dir: 'up', finding: true, kind: 'curl',
      setup: 'Standing, a dumbbell in each hand, elbows pinned to your sides.',
      points: ['Arms all the way straight at the bottom.', 'Curl up without swinging.', 'Lower slowly for three seconds.'],
      squeeze: 'Squeeze at the top', swap: 'rung:-1',
      video: V('jjnJHhzZUUM', 'Jeremy Ethier', 0, 'MKWBV29S6c0', 'Andrew Kwong')
    },
    oh_triceps: {
      name: 'Overhead triceps extension', slot: 'Arms', region: 'upper', ladder: 'triceps', range: [10, 15], dir: 'lower', finding: true, kind: 'triceps',
      setup: 'Seated on the chair against the wall, one dumbbell in both hands overhead.',
      points: ['Back against the chair, ribs down.', 'Lower behind your head into a deep stretch.', 'Reach for the ceiling to straighten.'],
      squeeze: 'Reach for the ceiling', swap: 'rung:-1',
      video: V('kYnFH6nw210', 'Horton Barbell', 0, 'J565P8FzJXA', 'Andrew Kwong'), flag: true
    },
    lateral_raise: {
      name: 'Lateral raise', slot: 'Shoulders', region: 'upper', ladder: 'lateral', range: [12, 20], dir: 'up', finding: true, kind: 'lateral',
      setup: 'Standing tall, weights at your sides.',
      points: ['Lead with your elbows.', 'Up to shoulder height, no higher.', 'Shoulders down, lower slowly.'],
      squeeze: 'Push your hands out to the walls', swap: 'rung:-1',
      video: V('gfEyrmxbCbw', 'Live Lean TV', 0, '07d6EYJH9lQ', 'Bob & Brad (PTs)', 366), flag: true
    },
    calf_raise: {
      name: 'Calf raise', slot: 'Calves', region: 'lower', ladder: 'calf', range: [12, 20], dir: 'calf', finding: false, kind: 'calf',
      setup: 'Ball of the foot on the bottom stair, hand on the rail or the wall.',
      points: ['Knees straight but soft. It\'s all ankle.', 'Up for one second, down for two.', 'Pause low in the stretch, then push through your big toe.'],
      squeeze: 'Pause low, push through your big toe', swap: 'calf_raise:1',
      video: V('eDd56TbWUCo', 'Complete Physio', 0, 'OuKvSpudVZ0', 'Bob & Brad (PTs)'), flag: true
    }
  };
  /** Her gentle start (program part 10): fixed reps, her videos. */
  var GENTLE = {
    breathing: { slot: 'Core', kind: 'core', name: 'Breathing with the pelvic floor', seconds: 120, video: V('XAyzSCRJZOs', 'Dr. Riva Preil (pelvic floor PT)', 0, 'PJprXsSvdag', 'UCLH NHS'),
      setup: 'Lie on your back, knees bent, one hand on your belly.', points: ['Breathe in through your nose. Let the belly and the pelvic floor soften.', 'Breathe out with a long sigh and feel a gentle lift.', 'Never hold your breath.'] },
    g_bridge: { slot: 'Hip', kind: 'bridge', name: 'Glute bridge with loop band', reps: 10, video: V('pYSVQ4a0LU8', 'Margaret Martin (PT)', 0, 'ktdIgom5B18', 'Fitasamamabear'), setup: 'Loop band above your knees, feet flat.', points: ['Breathe out as you lift.', 'Hips up to a straight line.', 'Lower slowly.'] },
    g_row: { slot: 'Pull', kind: 'row', name: 'Band row', reps: 12, rung: 'Yellow band · just tight', video: MOVES.band_row.video, setup: MOVES.band_row.setup, points: MOVES.band_row.points },
    g_deadbug: { slot: 'Core', kind: 'core', name: 'Dead bug', reps: 6, side: true, video: MOVES.dead_bug.herVideo, video2: V('6-anByqnKp8', 'Children\'s Hospital Colorado'), setup: 'On your back, low back on the floor.', points: ['Sessions 1 and 2: slide one heel out and back.', 'Then legs only: lower one heel to tap the floor.', 'Breathe out as you move.'] },
    g_wallpush: { slot: 'Push', kind: 'push', name: 'Wall push-up', reps: 10, video: V('IBmBttR_HVI', 'Rehab and Revive'), setup: 'Hands on the wall at shoulder height.', points: ['One straight line from head to heels.', 'Lower slowly.', 'Breathe out as you push the wall away.'] },
    g_clam: { slot: 'Hip', kind: 'clam', name: 'Clamshell with loop band', reps: 10, side: true, video: V('39vuP5xozsI', 'MedStar Health (PT)', 0, 'BCdb6pUR-4E', 'Institute of Sports and Spines'), setup: 'On your side, knees bent, loop band above your knees.', points: ['Feet together, lift the top knee.', 'Don\'t let your hips roll back.', 'Breathe out as you lift.'] },
    g_sitstand: { slot: 'Knee', kind: 'squat', name: 'Sit-to-stand from a chair', reps: 8, video: V('vOWUSGvoCgg', 'Dr. Carl Baird'), setup: 'Sit near the front of a sturdy chair, feet hip-width.', points: ['Lean forward a little.', 'Breathe out and stand tall.', 'Sit down slowly.'] }
  };
  var GENTLE_PAIRS = [['g_bridge', 'g_row'], ['g_deadbug', 'g_wallpush'], ['g_clam', 'g_sitstand']];
  var DOOR_ANCHOR = { name: 'Door anchor setup and band safety', video: V('cYF1mlR7yR8', 'Never Too Old to Lift (physio)', 0, '_Kj8i44KTkA', 'Bob & Brad (PTs)'),
    points: ['Anchor on the hinge side of a closed, locked door that opens away from you, so pulling holds it shut.', 'Look for nicks or white spots and retire a damaged band. Never let go of a stretched band.', 'Shoes on when a band is under your feet. Keep bands away from your face, and the girls away from a band under tension.'],
    latex: 'These bands are latex; if you\'ve ever reacted to latex, tell {owner} before using them.' };
  var WARM_VIDEO = V('X-3FwlRdyd8', 'Tony Gentilcore (CSCS)', 0, '9EiJBl7tB6A', 'Ohio State Wexner');
  var PULLAPART_VIDEO = V('mHWlgqPvyxI', 'Sports Rehab Expert (Greg Schaible, PT)', 0, 'bYsgk9SrJ48', 'Hinge Health');
  var AB_CHECK_VIDEO = V('96NrscE_2EM', 'Dr. Jena Bradley (DPT)', 0, 'ibPWvumrMHU', 'Nina Olson (PT)');

  // ------------------------------------------------------------- the feel-it table (program part 5) as data
  var CHIPS = ['Front of thighs', 'Back of thighs', 'Glutes', 'Side of hips', 'Knees', 'Calves', 'Low back', 'Abs', 'Sides of waist', 'Chest', 'Front of shoulders', 'Shoulders', 'Top of shoulders / neck', 'Upper back', 'Arms', 'Grip', 'Didn\'t feel much'];
  var FOLLOW = {
    hinge: { chip: 'Low back', q: 'Working a little, or tight or achy?', a: ['Working a little', 'Tight or achy'], wrong: 'Tight or achy' },
    push: { chip: 'Front of shoulders', q: 'A little, or mostly there?', a: ['A little', 'Mostly there'], wrong: 'Mostly there' },
    ohp: { chip: 'Top of shoulders / neck', q: 'A little, or mostly there?', a: ['A little', 'Mostly there'], wrong: 'Mostly there' },
    bridge: { chip: 'Back of thighs', q: 'A little, or cramping?', a: ['A little', 'Cramping'], wrong: 'Cramping' }
  };
  // per kind: right, fine, cue {chip: fix}, wrong {chip: [cause, fix, rungChange]}
  var FEEL = {
    squat: { right: ['Front of thighs', 'Glutes'], fine: ['Abs', 'Upper back'], cue: { 'Front of shoulders': 'Hold the dumbbell against your chest like a cup', Arms: 'Hold the dumbbell against your chest like a cup' },
      wrong: { Knees: ['Weight on the toes, or the knee caving in.', 'Weight in the middle of your foot and heel; knee follows your middle toes.'], 'Low back': ['Rounding at the bottom, or arching.', 'Stop just above where your back rounds; ribs down; breathe out on the way up.'] } },
    split: { right: ['Front of thighs', 'Glutes'], fine: ['Side of hips', 'Back of thighs'], cue: {},
      wrong: { Knees: ['Stance too short, knee shooting forward or caving in.', 'Take a longer step; back knee drops straight down like an elevator; knee follows your middle toes.'], 'Low back': ['Arching, leaning back.', 'Ribs down, a slight lean forward.'] } },
    hinge: { right: ['Back of thighs', 'Glutes'], fine: ['Grip', 'Low back:Working a little'], cue: { Knees: 'Soften your knees' },
      wrong: { 'Low back:Tight or achy': ['Knees locked, back rounding, going too low, weight drifting forward, or leaning back at the top.', 'Soft knees; push your hips back like closing a car door with your butt; stop when you feel the stretch in the back of your thighs; stand tall without leaning back.'], 'Front of thighs': ['Squatting instead of hinging.', 'Shins stay straight up and down; hips go back, not down.'] } },
    bridge: { right: ['Glutes'], fine: ['Side of hips', 'Back of thighs:A little'], cue: {},
      wrong: { 'Back of thighs:Cramping': ['Feet too far away.', 'Bring your heels closer.'], 'Low back': ['Arching at the top.', 'Lift with your hips, not your back; tuck your tailbone a little and stop in a straight line.'], 'Front of thighs': ['Feet too close.', 'Move your feet a little farther out.'] } },
    push: { right: ['Chest', 'Arms'], fine: ['Abs', 'Front of shoulders:A little'], cue: {},
      wrong: { 'Front of shoulders:Mostly there': ['Elbows flared out.', 'Elbows at about 45 degrees, like an arrow, not a T.'], 'Low back': ['Hips sagging.', 'One straight line from head to heels; squeeze your glutes.'] } },
    row: { right: ['Upper back', 'Shoulders'], fine: [], cue: { Arms: 'Start by pulling your shoulder blades back; elbows lead; loose grip', Grip: 'Start by pulling your shoulder blades back; elbows lead; loose grip' },
      wrong: { 'Top of shoulders / neck': ['Shrugging.', 'Shoulders away from your ears.', -1], 'Low back': ['Leaning back.', 'Stand tall.', -1] } },
    pulldown: { right: ['Upper back'], fine: ['Abs'], cue: { Arms: 'Pull your elbows down to your back pockets', Grip: 'Pull your elbows down to your back pockets' },
      wrong: { 'Top of shoulders / neck': ['Shrugging.', 'Shoulders down before you pull.'], 'Low back': ['Arching back to pull.', 'Ribs down.', -1] } },
    facepull: { right: ['Shoulders', 'Upper back'], fine: ['Arms'], cue: {},
      wrong: { 'Top of shoulders / neck': ['Shrugging, band too heavy.', 'Shoulders down; pull to your eyebrows.', -1] } },
    press: { right: ['Chest', 'Arms'], fine: ['Abs', 'Front of shoulders:A little'], cue: {},
      wrong: { 'Front of shoulders:Mostly there': ['Elbows flared, hands too high.', 'Elbows at 45 degrees; press at chest height.'], 'Low back': ['Leaning into it, arching.', 'Ribs down.', -1] } },
    ohp: { right: ['Shoulders', 'Arms'], fine: ['Upper back', 'Abs', 'Top of shoulders / neck:A little'], cue: {},
      wrong: { 'Top of shoulders / neck:Mostly there': ['Shrugging all the way up.', 'Shoulders down at the start; a little shrug at the very top is normal.', -1], 'Low back': ['Arching away from the chair.', 'Back against the chair; ribs down.', -1] } },
    pallof: { right: ['Sides of waist', 'Abs'], fine: ['Shoulders', 'Side of hips'], cue: { Arms: 'Press slowly and breathe out; the work is in your middle', Grip: 'Press slowly and breathe out; the work is in your middle' },
      wrong: { 'Low back': ['Twisting toward the door.', 'Don\'t let the band turn you; press straight out from your breastbone.', -1] } },
    core: { right: ['Abs'], fine: ['Front of thighs'], cue: {},
      wrong: { 'Low back': ['Arm or leg going too far (your back lifts off the floor).', 'Keep your low back on the floor; don\'t reach as far.'], 'Top of shoulders / neck': ['Head lifting.', 'Head stays down.'] } },
    curl: { right: ['Arms'], fine: ['Grip', 'Front of shoulders'], cue: {}, wrong: { 'Low back': ['Swinging the weight up.', 'Stand tall, no swing.', -1] } },
    triceps: { right: ['Arms'], fine: ['Shoulders'], cue: {}, wrong: { 'Low back': ['Arching off the chair.', 'Ribs down, back against the chair.', -1] } },
    lateral: { right: ['Shoulders'], fine: ['Arms'], cue: {}, wrong: { 'Top of shoulders / neck': ['Shrugging, going too high.', 'Shoulders down; stop at shoulder height.', -1] } },
    calf: { right: ['Calves'], fine: [], cue: { 'Front of thighs': 'Knees straight but soft; it\'s all ankle' }, wrong: { Knees: ['Locking or bending the knees.', 'Knees straight but not locked.'] } },
    // her gentle start's clamshell (audit B2: her moves showed the squat's card); from the move's own points
    clam: { right: ['Side of hips', 'Glutes'], fine: [], cue: {}, wrong: { 'Low back': ['The hips rolling back as the knee lifts.', 'Feet together; lift only as far as you can without your hips rolling back.'] } }
  };
  function feelKind(moveId) {
    var m = MOVES[moveId] || GENTLE[moveId] || {};
    if (moveId === 'pulldown') return 'pulldown';
    if (moveId === 'face_pull') return 'facepull';
    return m.kind || 'squat';
  }
  function followFor(moveId, chip) {
    var k = feelKind(moveId);
    if (k === 'hinge' && chip === 'Low back') return FOLLOW.hinge;
    if ((k === 'push' || k === 'press') && chip === 'Front of shoulders') return FOLLOW.push;
    if (k === 'ohp' && chip === 'Top of shoulders / neck') return FOLLOW.ohp;
    if (k === 'bridge' && chip === 'Back of thighs') return FOLLOW.bridge;
    return null;
  }
  /** The chips for a move: its right places and its known wrong places first (screen 04), then the rest. */
  function chipsFor(moveId) {
    var f = FEEL[feelKind(moveId)], seen = {}, out = [];
    var add = function (c) { c = String(c).split(':')[0]; if (!seen[c]) { seen[c] = 1; out.push(c); } };
    f.right.forEach(add); Object.keys(f.wrong).forEach(add); Object.keys(f.cue).forEach(add); f.fine.forEach(add);
    CHIPS.forEach(add);
    return out;
  }
  /** How many of chipsFor() show before "Somewhere else": the right and the wrong places. */
  function chipsFirst(moveId) { var f = FEEL[feelKind(moveId)], s = {}; f.right.concat(Object.keys(f.wrong)).forEach(function (c) { s[String(c).split(':')[0]] = 1; }); return Object.keys(s).length; }
  /** The verdict for one answer: {kind: right|fine|cue|wrong|none, cause, fix, rung (-1 or 0), cue, follow (a question to ask first)}. */
  function feelVerdict(moveId, chip, answer) {
    var f = FEEL[feelKind(moveId)], m = MOVES[moveId] || {};
    if (!chip) return { kind: 'none' };
    if (chip === 'Didn\'t feel much') return { kind: 'cue', cue: m.squeeze || '', squeeze: true };
    var fq = followFor(moveId, chip);
    if (fq && !answer) return { kind: 'ask', follow: fq };
    var key = fq ? chip + ':' + answer : chip;
    if (f.wrong[key]) return { kind: 'wrong', key: key, cause: f.wrong[key][0], fix: f.wrong[key][1], rung: f.wrong[key][2] || 0 };
    if (fq && answer !== fq.wrong) return { kind: 'fine', key: key };
    if (f.right.indexOf(chip) >= 0) return { kind: 'right', key: chip };
    if (f.cue[chip]) return { kind: 'cue', key: chip, cue: f.cue[chip] };
    if (f.fine.indexOf(chip) >= 0) return { kind: 'fine', key: chip };
    return { kind: 'fine', key: chip };
  }

  // ============================================================= ladders (program part 3)
  var POS = { 1: 'just tight', 2: 'half a step out', 3: 'a full step out' };
  var POS_KNEEL = { 1: 'kneel where the band is just tight', 2: 'kneel half a step back', 3: 'kneel a full step back' };
  var POS_SPOKEN = { 1: 'band just tight', 2: 'half a step out', 3: 'one step out' };
  function cap1(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function lbs(w) { return String(w).replace(/\.0$/, ''); }
  /** Dumbbell weights from Settings → Equipment: the fixed pairs, plus an adjustable pair's steps. */
  function dumbbells(eq) {
    eq = eq || {};
    var w = [].concat(eq.dumbbells || [5, 10]).map(Number).filter(function (x) { return x > 0; });
    var a = eq.adjustable;
    if (a && +a.max > 0) {
      var step = +a.step || 2.5, x = +a.min || step;
      for (var guard = 0; x <= +a.max + 1e-9 && guard < 60; guard++) { w.push(Math.round(x * 10) / 10); x += x < (+a.fine || 25) ? step : (+a.coarse || 5); }
    }
    var seen = {};
    return w.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }).sort(function (p, q) { return p - q; });
  }
  function bandSteps(eq) { return L.bandLadder(eq && eq.tubes ? eq : K.EQUIPMENT_DEFAULT); }
  function tempoRungs(base, words) {
    return [
      { key: base + ':t5', label: words + ' · 5-second lowering', down: 5 },
      { key: base + ':t5p', label: words + ' · 5-second lowering, 2-second pause', down: 5, pause: 2 }
    ];
  }
  /** Door-anchored band rungs: the lightest band at P1–P3, the next at P1–P2, then each heavier step at P1 only. */
  function bandRungs(eq, kneel) {
    var steps = bandSteps(eq), out = [];
    steps.forEach(function (s, i) {
      var maxPos = i === 0 ? 3 : (i === 1 ? 2 : 1);
      for (var p = 1; p <= maxPos; p++) {
        var where = kneel ? POS_KNEEL[p] : POS[p];
        out.push({ key: 'band:' + s.key + ':p' + p, band: s.key, pos: p, lb: s.lb, label: cap1(s.short) + (s.colors.length > 1 ? ' bands' : ' band') + ' · ' + where, short: s.short + ', ' + where });
      }
    });
    return out;
  }
  function rungsFor(ladder, eq, opts) {
    opts = opts || {};
    var db = dumbbells(eq), top = db[db.length - 1] || 10, R = [];
    var each = function (min, fn) { db.filter(function (w) { return w >= min; }).forEach(fn); };
    switch (ladder) {
      case 'band': return bandRungs(eq, opts.kneel);
      case 'press': bandSteps(eq).forEach(function (s) { R.push({ key: 'press:' + s.key, band: s.key, lb: s.lb, label: cap1(s.short) + ' band' }); R.push({ key: 'press:' + s.key + ':t5', band: s.key, lb: s.lb, down: 5, label: cap1(s.short) + ' band · 5-second lowering' }); }); return R;
      case 'boxSquat':
        R.push({ key: 'box:bw', label: 'Box squat to a chair · arms forward', drill: true });
        each(5, function (w) { R.push({ key: 'box:' + w, w: w, label: 'Goblet box squat · one ' + lbs(w) + ' lb' }); });
        R.push({ key: 'box:' + top + ':pause', w: top, pause: 1, label: 'Goblet box squat · one ' + lbs(top) + ' · 1-second pause on the box' });
        R.push({ key: 'gob:' + top, w: top, label: 'Goblet squat, no box · one ' + lbs(top) });
        return R.concat(tempoRungs('gob:' + top, 'Goblet squat · one ' + lbs(top)));
      case 'squat15':
        R.push({ key: 's15:bw', label: '1½-rep squat · bodyweight' });
        each(5, function (w) { R.push({ key: 's15:' + w, w: w, label: '1½-rep squat · one ' + lbs(w) }); });
        return R.concat(tempoRungs('s15:' + top, '1½-rep squat · one ' + lbs(top)));
      case 'split':
        R.push({ key: 'split:wall', label: 'Hand on the wall · bodyweight' }, { key: 'split:bw', label: 'No hand · bodyweight' });
        each(5, function (w) { R.push({ key: 'split:' + w, w: w, label: 'Two ' + lbs(w) + 's' }); });
        bandSteps(eq).slice(0, 2).forEach(function (s) { R.push({ key: 'split:' + top + ':' + s.key, w: top, band: s.key, label: 'Two ' + lbs(top) + 's + ' + s.short + ' band under the front foot' }); });
        return R.concat(tempoRungs('split:' + top + ':band', 'Two ' + lbs(top) + 's + band'));
      case 'hinge': return [{ key: 'hinge:wall', label: 'Hips to the wall', drill: true }, { key: 'hinge:stick', label: 'Broomstick hinge', drill: true }];
      case 'rdl':
        R.push({ key: 'rdl:5:knee', w: 5, label: 'Two 5s · stop at the knees' }, { key: 'rdl:5', w: 5, label: 'Two 5s · to mid-shin' });
        each(5.01, function (w) { R.push({ key: 'rdl:' + w, w: w, label: 'Two ' + lbs(w) + 's' }); });
        return R.concat(tempoRungs('rdl:' + top, 'Two ' + lbs(top) + 's'));
      case 'bstance':
        R.push({ key: 'bst:1x' + Math.min(10, top), w: Math.min(10, top), label: 'One ' + lbs(Math.min(10, top)) + ', in the hand opposite the front leg' });
        each(Math.min(10, top), function (w) { R.push({ key: 'bst:' + w, w: w, label: 'Two ' + lbs(w) + 's' }); });
        return R.concat(tempoRungs('bst:' + top, 'Two ' + lbs(top) + 's'));
      case 'bridge':
        R.push({ key: 'br:loop', label: 'Glute bridge · loop band' }, { key: 'br:loop:sq', label: 'Glute bridge · loop band, 2-second squeeze', squeeze: 2 }, { key: 'ht:loop', label: 'Hip thrust · shoulders on the couch, loop band' });
        each(Math.min(10, top), function (w) { R.push({ key: 'ht:' + w, w: w, label: 'Hip thrust · holding the ' + lbs(w) + ' on your hips' }); });
        R.push({ key: 'ht:' + top + ':sq', w: top, squeeze: 2, label: 'Hip thrust · holding the ' + lbs(top) + ', 2-second squeeze' });
        return R;
      case 'slThrust': return [{ key: 'slt:floor', label: 'Single-leg glute bridge on the floor' }, { key: 'slt:couch', label: 'Single-leg hip thrust · shoulders on the couch' }, { key: 'slt:couch:sq', squeeze: 2, label: 'Single-leg hip thrust · 2-second squeeze' }];
      case 'pushup': return [{ key: 'pu:wall', label: 'Wall' }, { key: 'pu:counter', label: 'Kitchen counter' }, { key: 'pu:counter:t5', down: 5, label: 'Counter · 5-second lowering' }, { key: 'pu:chair', label: 'Sturdy chair against a wall' }, { key: 'pu:chair:t5', down: 5, label: 'Chair · 5-second lowering' }, { key: 'pu:floor:neg', down: 5, label: 'Floor · lower slowly, then knees down to come up' }, { key: 'pu:floor', label: 'Floor' }];
      case 'deadBug': return [{ key: 'db:heel', label: 'Heel slides' }, { key: 'db:legs', label: 'Legs only · heel taps' }, { key: 'db:opp', label: 'Opposite arm and leg, knees bent' }, { key: 'db:long', label: 'Long reach, legs nearly straight', harder: true }];
      case 'curl':
        each(5, function (w) { R.push({ key: 'curl:' + w, w: w, label: 'Two ' + lbs(w) + 's' }, { key: 'curl:' + w + ':t5', w: w, down: 5, label: 'Two ' + lbs(w) + 's · 5-second lowering' }); });
        R.push({ key: 'curl:' + top + ':p', w: top, down: 5, pause: 2, label: 'Two ' + lbs(top) + 's · 5-second lowering, 2-second pause halfway' });
        bandSteps(eq).slice(2).forEach(function (s) { R.push({ key: 'curl:band:' + s.key, band: s.key, lb: s.lb, label: 'Band curl standing on the band · ' + s.short }); });
        return R;
      case 'triceps':
        each(5, function (w) { R.push({ key: 'tri:' + w, w: w, label: 'One ' + lbs(w) }); });
        R.push({ key: 'tri:' + top + ':t5', w: top, down: 5, label: 'One ' + lbs(top) + ' · 5-second lowering' }, { key: 'tri:' + top + ':p', w: top, down: 5, pause: 2, label: 'One ' + lbs(top) + ' · 2-second pause in the stretch' });
        bandRungs(eq).filter(function (r, i) { return i >= 3; }).forEach(function (r) { R.push({ key: 'tri:' + r.key, band: r.band, pos: r.pos, lb: r.lb, label: 'Band overhead extension · ' + r.label.replace(/^./, function (c) { return c.toLowerCase(); }) }); });
        return R;
      case 'lateral':
        R.push({ key: 'lat:yellow', band: 'yellow', label: 'Yellow band, standing on it' });
        each(5, function (w) { R.push({ key: 'lat:' + w, w: w, label: 'Two ' + lbs(w) + 's' }, { key: 'lat:' + w + ':t5', w: w, down: 5, label: 'Two ' + lbs(w) + 's · 5-second lowering' }, { key: 'lat:' + w + ':p', w: w, down: 5, pause: 2, label: 'Two ' + lbs(w) + 's · 2-second pause at the top' }); });
        return R;
      case 'calf':
        return [{ key: 'calf:floor', label: 'Both legs, on the floor' }, { key: 'calf:stair', label: 'Both legs, on the stair edge' }, { key: 'calf:stair:' + Math.min(10, top), w: Math.min(10, top), label: 'Both legs, holding one ' + lbs(Math.min(10, top)) },
          { key: 'calf:1', single: true, label: 'Single leg' }, { key: 'calf:1:5', single: true, w: 5, label: 'Single leg, holding a 5' }, { key: 'calf:1:' + Math.min(10, top), single: true, w: Math.min(10, top), label: 'Single leg, holding a ' + lbs(Math.min(10, top)) },
          { key: 'calf:1:p', single: true, pause: 2, label: 'Single leg · 2-second pause in the stretch' }, { key: 'calf:1:t5', single: true, down: 5, pause: 2, label: 'Single leg · 5-second lowering, 2-second pause' }];
    }
    return [{ key: 'bw', label: 'Bodyweight' }];
  }
  function ladderOf(moveId, eq) { var m = MOVES[moveId]; return m ? rungsFor(m.ladder, eq, { kneel: m.kneel }) : []; }
  function keyIndex(lad, key) { for (var i = 0; i < lad.length; i++) if (lad[i].key === key) return i; return -1; }
  /** Start rungs (part 3's table), as an index into the person's ladder. who: 's' (his column) or 'f' (hers). */
  function startRung(moveId, who, eq, history) {
    var lad = ladderOf(moveId, eq), f = who === 'f', h = history || {};
    var findKey = function (k) { var i = keyIndex(lad, k); return i < 0 ? 0 : i; };
    var bandAt = function (color, pos) { for (var i = 0; i < lad.length; i++) if (lad[i].band === color && (!pos || lad[i].pos === pos)) return i; return 0; };
    switch (moveId) {
      case 'band_row': case 'pulldown': case 'chest_press': return f ? 0 : bandAt('blue', 1);
      case 'face_pull': case 'pallof': case 'seated_press': return 0;
      case 'pull_through': return f ? bandAt('blue', 1) : bandAt('green', 1);
      case 'pushup': case 'dead_bug': return f ? 0 : 1;
      case 'curl': return f ? 0 : Math.min(2, lad.length - 1);
      case 'oh_triceps': case 'lateral_raise': case 'calf_raise': return f ? 0 : 1;
      case 'squat15': return h.boxReached10 ? 2 : 0;
      case 'rfess': return 0; // rung 1 in the Light week; the move-up from the split squat is handled by harderStart
      case 'bstance_rdl': return f ? 0 : (h.rdlReached3 ? 1 : 0);
      case 'sl_hip_thrust': return f ? 0 : 1;
      default: return 0;
    }
  }

  // ============================================================= workouts and blocks (program parts 1–2)
  var WORKOUTS = {
    A: [['box_squat', 'band_row'], ['pull_through', 'pushup'], ['seated_press', 'pallof'], ['curl', 'calf_raise']],
    B: [['split_squat', 'pulldown'], ['db_rdl', 'pushup'], ['face_pull', 'dead_bug'], ['oh_triceps', 'lateral_raise']],
    C: [['split_squat', 'band_row'], ['bridge', 'chest_press'], ['face_pull', 'dead_bug'], ['lateral_raise', 'calf_raise']]
  };
  var HARDER = { box_squat: 'squat15', split_squat: 'rfess', db_rdl: 'bstance_rdl', bridge: 'sl_hip_thrust' };
  var SQUEEZE_HARDER = { band_row: 'squeeze', pulldown: 'squeeze', face_pull: 'squeeze', pull_through: 'squeeze', chest_press: 'hold', seated_press: 'hold' };
  var BLOCK_NAMES = { learn: 'Learn', build: 'Build', light: 'Light', harder: 'Harder' };
  var TARGET = { learn: '3+', build: '1-2', light: '3+', harder: '1-2' };
  function letterOf(n) { return 'ABC'.charAt((Math.max(1, n) - 1) % 3); }
  function blockOf(n, lightAt) {
    lightAt = lightAt || 19;
    if (n <= 6) return 'learn';
    if (n < lightAt) return 'build';
    if (n < lightAt + 3) return 'light';
    return 'harder';
  }
  function weekOf(n) { return Math.floor((Math.max(1, n) - 1) / 3) + 1; }
  /** The block's line for the card: "Learn week 1 of 2", "Build week 3", "Light week", "Harder week 9". */
  function blockLine(n, lightAt) {
    var b = blockOf(n, lightAt), w = weekOf(n);
    if (b === 'learn') return 'Learn week ' + w + ' of 2';
    if (b === 'light') return 'Light week';
    return BLOCK_NAMES[b] + ' week ' + w;
  }

  // ============================================================= timing (program part 9)
  var T = { rep: 4, repLearn: 5, getSet: 10, switchSide: 10, toPair: 25, rest: 45, setupAnchor: 60, setupBand: 35, setupOther: 20, lastTaps: 30, avgReps: 12, avgRepsSide: 10 };
  /** Seconds per rep for a move on a rung (tempo, pauses, squeezes, holds). */
  function repSeconds(moveId, rung, ctx) {
    var m = MOVES[moveId] || {};
    var down = (rung && rung.down) || 3, up = 1, extra = 0;
    if (m.dir === 'calf') { down = (rung && rung.down) || 2; extra = 1; }
    if (m.dir === 'pallof') { down = 1; extra = (ctx && ctx.harder) ? 3 : 2; }
    if (rung && rung.pause) extra += rung.pause;
    if (rung && rung.squeeze) extra += rung.squeeze;
    if (ctx && ctx.harder && SQUEEZE_HARDER[moveId]) extra += 1;
    if (ctx && ctx.learn && m.dir !== 'pallof') extra += 1;
    if (moveId === 'squat15') down += 2; // the extra half rep
    return down + up + extra;
  }
  /** The beat words the voice says for one rep (each beat one second). */
  function beats(moveId, rung, ctx) {
    var m = MOVES[moveId] || {}, n = repSeconds(moveId, rung, ctx);
    var NUM = ['two', 'three', 'four', 'five', 'six'];
    var count = function (word, k) { var o = [word]; for (var i = 1; i < k; i++) o.push(NUM[i - 1] || 'hold'); return o; };
    var down = (rung && rung.down) || 3, pause = (rung && rung.pause) || 0, hold = (ctx && ctx.harder && SQUEEZE_HARDER[moveId]) ? 1 : 0;
    var learnPause = ctx && ctx.learn && m.dir !== 'pallof' ? 1 : 0;
    var sq = (rung && rung.squeeze) || 0;
    var out;
    switch (m.dir) {
      case 'pull': out = ['Pull'].concat(hold ? ['Squeeze'] : []).concat(learnPause ? ['Pause'] : []).concat(count('Back', down)); break;
      case 'push': out = [moveId === 'seated_press' ? 'Press' : 'Push'].concat(hold ? ['Hold'] : []).concat(learnPause ? ['Pause'] : []).concat(count(moveId === 'seated_press' ? 'Down' : 'Back', down)); break;
      case 'up': out = ['Up'].concat(sq ? count('Squeeze', sq) : []).concat(learnPause ? ['Pause'] : []).concat(count('Down', down)); if (pause) out.splice(1, 0, 'Hold', 'two'); break;
      case 'calf': out = ['Up'].concat(count('Down', down)).concat(['Pause']).concat(pause ? ['Hold', 'two'] : []); break;
      case 'pallof': out = ['Press'].concat(count('Hold', (ctx && ctx.harder) ? 3 : 2)).concat(['Back']); break;
      case 'reach': out = count('Reach', down).concat(learnPause ? ['Pause'] : []).concat(['Back']); break;
      default: out = count('Down', down + (moveId === 'squat15' ? 2 : 0)).concat(pause ? count('Hold', pause) : []).concat(learnPause ? ['Pause'] : []).concat(['Up']);
    }
    while (out.length < n) out.push('Hold');
    return out.slice(0, Math.max(n, out.length));
  }

  // ============================================================= the session (parts 1, 2, 7, 8, 9, 10)
  var WARM = {
    s: [{ id: 'march', name: 'March in place', seconds: 30, timed: true, line: 'March in place for thirty seconds.' }],
    f: [{ id: 'breaths', name: 'Four slow breaths', seconds: 30, timed: true, line: 'Four slow breaths. In through the nose, let the belly and the pelvic floor soften, then a long sigh out.' }],
    both: [
      { id: 'pullapart', name: 'Band pull-apart', reps: 12, seconds: 45, line: 'Band pull-apart, twelve times. Breathe out as you pull.' },
      { id: 'wbridge', name: 'Glute bridge', reps: 10, seconds: 50, line: 'Glute bridge, ten times. Breathe out on the way up.' },
      { id: 'whinge', name: 'Hinge drill', reps: 8, seconds: 45, line: 'Hinge drill, eight times. Push your hips back.' },
      { id: 'wsquat', name: 'Box squat to a chair', reps: 8, seconds: 45, line: 'Box squat to a chair, eight times.', lineF: 'Box squat to a chair, eight times. Feet hip-width.' }
    ]
  };
  var COOL = {
    regular: [
      { id: 'hipflex1', name: 'Hip-flexor stretch, left', seconds: 30, line: 'Half-kneeling hip-flexor stretch. Squeeze the back leg\'s glute, ribs down, no arching.' },
      { id: 'hipflex2', name: 'Hip-flexor stretch, right', seconds: 30, line: 'Switch sides.' },
      { id: 'doorway', name: 'Doorway chest stretch', seconds: 30, line: 'Doorway chest stretch, elbows at shoulder height. Mild, never pain.', lineF: 'Doorway chest stretch, gentle. Skip it if your breasts are full or tender.' },
      { id: 'child', name: 'Child\'s pose', seconds: 30, line: 'Child\'s pose, arms reaching forward. Slow breaths.', lineF: 'Child\'s pose. A belly breath in, let the pelvic floor soften, a sigh out. Or lie on your back with knees bent.' }
    ],
    short: [
      { id: 'hipflex1', name: 'Hip-flexor stretch, left', seconds: 20, line: 'Half-kneeling hip-flexor stretch. Squeeze the back leg\'s glute, ribs down, no arching.' },
      { id: 'hipflex2', name: 'Hip-flexor stretch, right', seconds: 20, line: 'Switch sides.' },
      { id: 'child', name: 'Child\'s pose', seconds: 20, line: 'Child\'s pose, arms reaching forward. Slow breaths.', lineF: 'Child\'s pose. A belly breath in, let the pelvic floor soften, a sigh out. Or lie on your back with knees bent.' }
    ]
  };
  /** Which move fills a slot today (the hinge unlock, the harder versions, her gate). */
  function slotMove(letter, pi, side, o) {
    var id = WORKOUTS[letter][pi][side];
    var hip = pi === 1 && side === 0 && (letter === 'A' || letter === 'B');
    if (hip && !o.hingeUnlocked) id = o.n <= 6 ? 'hinge_drill' : 'bridge';
    if ((o.block === 'light' || o.block === 'harder') && pi <= 2 && HARDER[id]) {
      var hv = HARDER[id];
      if (!(o.who === 'f' && MOVES[hv].herGate && !o.gateClear)) id = hv;
    }
    return id;
  }
  function pairAnchor(a, b) { return (MOVES[a] && MOVES[a].anchor) || (MOVES[b] && MOVES[b].anchor) || null; }
  /**
   * Build one workout. o: { who 's'|'f', n, lightAt, length 'short'|'regular'|'full', rungs {moveId: index}, eq, learned {moveId: true},
   *   hingeUnlocked, gateClear (hers: 3 All good in a row), gateOff (today: Something felt off), lighter, welcome (one rung easier, 3+),
   *   findings {moveId: sessions done}, stuck {moveId: true}, medians {pace, setup}, lastReps {moveId: reps} }
   * → { n, letter, block, length, pairs: [{a, b, rounds, anchor}], moves: {id: {...}}, steps: [...], planned (seconds) }
   */
  function session(o) {
    var n = Math.max(1, o.n || 1), letter = letterOf(n), block = blockOf(n, o.lightAt);
    var length = block === 'learn' || block === 'light' ? 'one' : (o.length || 'regular');
    var who = o.who === 'f' ? 'f' : 's';
    var ctx = { learn: block === 'learn', harder: block === 'harder' || block === 'light' };
    var npairs = block === 'learn' || length === 'short' ? 2 : (n <= 9 && block === 'build' ? 3 : 4);
    var pairs = [];
    for (var pi = 0; pi < npairs; pi++) {
      var a = slotMove(letter, pi, 0, { n: n, block: block, who: who, hingeUnlocked: o.hingeUnlocked, gateClear: o.gateClear });
      var b = slotMove(letter, pi, 1, { n: n, block: block, who: who, hingeUnlocked: o.hingeUnlocked, gateClear: o.gateClear });
      var rounds = block === 'light' ? 1 : (length === 'full' && pi < 2 ? 3 : 2);
      if (o.lighter && rounds > 1) rounds--;
      pairs.push({ a: a, b: b, rounds: rounds, anchor: pairAnchor(a, b) });
    }
    var moves = {};
    pairs.forEach(function (p) { [p.a, p.b].forEach(function (id) { moves[id] = moveToday(id, o, block, ctx); }); });
    // the calibration set (him only): workout 6's last band-row set, workout 9's last chest-press set
    if (who === 's' && n === 6 && moves.band_row) moves.band_row.calibrate = true;
    if (who === 's' && n === 9 && moves.chest_press) moves.chest_press.calibrate = true;
    if (who === 's' && block === 'harder' && length === 'full' && moves.face_pull) moves.face_pull.dropSet = true;
    var steps = buildSteps(o, pairs, moves, block, length, who);
    var planned = steps.reduce(function (s, st) { return s + (st.planned || 0); }, 0);
    return { n: n, letter: letter, block: block, blockName: BLOCK_NAMES[block], line: blockLine(n, o.lightAt), target: TARGET[block], length: length, who: who, pairs: pairs, moves: moves, steps: steps, planned: planned, ctx: ctx };
  }
  function moveToday(id, o, block, ctx) {
    var m = MOVES[id], lad = ladderOf(id, o.eq), rungs = o.rungs || {};
    var idx = rungs[id] != null ? rungs[id] : startRung(id, o.who, o.eq, o.history);
    var ease = 0;
    if (o.welcome) ease++;
    if (o.lighter) ease++;
    if (o.who === 'f' && o.gateOff && (m.region === 'lower' || m.region === 'core')) ease++;
    idx = Math.max(0, Math.min(lad.length - 1, idx - ease));
    // her harder rungs stay locked until 3 All good in a row (long-reach dead bug, single-leg calf raise)
    if (o.who === 'f' && !o.gateClear) {
      if (id === 'dead_bug') idx = Math.min(idx, 2);
      if (id === 'calf_raise') idx = Math.min(idx, 2);
    }
    if (id === 'dead_bug' && block !== 'light' && block !== 'harder') idx = Math.min(idx, 2);
    var finds = (o.findings || {})[id] || 0;
    var finding = !!m.finding && finds < 2 && !o.welcome;
    var range = [m.range[0], m.range[1] + ((o.topBonus || {})[id] || 0)];
    var rung = lad[idx] || { key: 'bw', label: 'Bodyweight' };
    if (id === 'calf_raise' && rung.single) range = [10, 15 + ((o.topBonus || {})[id] || 0)];
    return {
      id: id, name: id === 'bridge' && idx <= 1 ? MOVES.bridge.first : (id === 'box_squat' && idx === 0 ? MOVES.box_squat.first : m.name),
      rungIndex: idx, rung: rung, rungs: lad.length, range: range, side: !!m.side || (id === 'calf_raise' && !!rung.single),
      finding: finding, near: !!(o.stuck || {})[id] && o.who !== 'f', learn: !(o.learned || {})[id], squeeze: m.squeeze,
      repSec: repSeconds(id, rung, ctx), beats: beats(id, rung, ctx), expect: (o.lastReps || {})[id] || null
    };
  }
  function setPlanned(mv, o) {
    var reps = mv.expect || (mv.side ? T.avgRepsSide : T.avgReps);
    if (mv.finding) reps = Math.max(reps, 20);
    var pace = (o.medians && o.medians.pace) || 1;
    var t = T.getSet + reps * mv.repSec * (mv.side ? 2 : 1) + (mv.side ? T.switchSide : 0);
    return Math.round(t * pace);
  }
  function buildSteps(o, pairs, moves, block, length, who) {
    var steps = [], setupF = (o.medians && o.medians.setup) || 1;
    var short = length === 'short';
    var learn = block === 'learn'; // the Learn block's one length: the first 30 s kept, the short cool-down (part 9's 18–20 min)
    var warm = (short ? [] : WARM[who]).concat(WARM.both);
    var warmTotal = short ? 180 : (learn ? 210 : 240), warmSum = warm.reduce(function (s, w) { return s + w.seconds; }, 0);
    warm.forEach(function (w, i) { steps.push({ type: 'warm', id: w.id, name: w.name, reps: w.reps || 0, timed: !!w.timed, seconds: w.seconds, line: who === 'f' && w.lineF ? w.lineF : w.line, n: i + 1, of: warm.length, planned: Math.round(w.seconds * warmTotal / warmSum) }); });
    if (pairs[0].anchor) steps.push({ type: 'rest', setup: true, first: true, seconds: Math.round(T.setupAnchor * setupF), anchor: pairs[0].anchor, next: pairs[0].a, nextRound: 1, planned: Math.round(T.setupAnchor * setupF) });
    pairs.forEach(function (p, pi) {
      for (var r = 1; r <= p.rounds; r++) {
        [p.a, p.b].forEach(function (id, k) {
          var mv = moves[id];
          var last = r === p.rounds;
          var st = { type: 'set', move: id, pair: pi, round: r, rounds: p.rounds, set: r, of: p.rounds, finding: mv.finding && r === 1, planned: setPlanned(mv, o) };
          if (last && mv.calibrate) st.calibrate = true;
          if (last && mv.near) st.near = true;
          if (last && mv.dropSet) st.dropSet = true;
          if (mv.learn && r === 1) st.learnFirst = true;
          if (st.finding) st.planned = Math.round(st.planned * 1.4);
          steps.push(st);
          if (k === 0) steps.push({ type: 'pairgo', move: p.b, planned: T.toPair });
        });
        var lastPair = pi === pairs.length - 1;
        if (r < p.rounds) steps.push({ type: 'rest', seconds: T.rest, planned: T.rest, next: p.a, nextRound: r + 1 });
        else if (!lastPair) {
          var nx = pairs[pi + 1];
          var setup = nx.anchor && nx.anchor !== p.anchor ? T.setupAnchor : (nx.anchor && nx.anchor === p.anchor ? T.setupBand : T.setupOther);
          // between pairs the setup time is the rest (program part 9's table); the countdown and the plan are the same number
          // (the rehearsal found a 45 s countdown against a 20 s plan)
          var setupSec = Math.round(setup * setupF);
          steps.push({ type: 'rest', seconds: setupSec, planned: setupSec, next: nx.a, nextRound: 1, setup: true, anchor: nx.anchor && nx.anchor !== p.anchor ? nx.anchor : null });
        }
      }
    });
    steps.push({ type: 'taps', planned: T.lastTaps });
    var cool = short || learn ? COOL.short : COOL.regular;
    cool.forEach(function (c, i) { steps.push({ type: 'cool', id: c.id, name: c.name, seconds: c.seconds, line: who === 'f' && c.lineF ? c.lineF : c.line, n: i + 1, of: cool.length, planned: c.seconds }); });
    steps.push({ type: 'done', planned: 0 });
    // Learn screens: about 30 seconds per new move, the first time
    var learnSec = Object.keys(moves).filter(function (id) { return moves[id].learn; }).length * 30;
    if (learnSec) steps[0].planned += 0, steps.learnSec = learnSec;
    return steps;
  }
  /** Seconds left from step i (the current step's remaining seconds given). */
  function timeLeft(sess, i, currentLeft) {
    var s = 0;
    for (var k = i + 1; k < sess.steps.length; k++) s += sess.steps[k].planned || 0;
    var learnLeft = 0;
    for (var j = i; j < sess.steps.length; j++) { var st = sess.steps[j]; if (st.type === 'set' && st.learnFirst && !st.learned) learnLeft += 30; }
    return s + Math.max(0, currentLeft || 0) + learnLeft;
  }
  function plannedTotal(sess) { return sess.planned + (sess.steps.learnSec || 0); }
  /** Her gentle start session (part 10): breathing 2 min, three pairs × 2 rounds, 30 s rest, cool-down 1 min. */
  function gentleSession(o) {
    o = o || {};
    var k = (o.done || 0) + 1, steps = [];
    steps.push({ type: 'warm', id: 'breathing', name: GENTLE.breathing.name, timed: true, seconds: 120, line: 'Breathing with the pelvic floor. Breathe in through your nose and let the belly soften. A long sigh out.', n: 1, of: 1, planned: 120 });
    GENTLE_PAIRS.forEach(function (p, pi) {
      for (var r = 1; r <= 2; r++) {
        p.forEach(function (id, j) {
          var g = GENTLE[id];
          var name = id === 'g_deadbug' ? (k <= 2 ? 'Heel slides' : 'Dead bug, legs only') : g.name;
          steps.push({ type: 'set', gentle: true, move: id, name: name, reps: g.reps, side: !!g.side, pair: pi, round: r, set: r, of: 2, learnFirst: !(o.learned || {})[id] && r === 1, planned: T.getSet + g.reps * 4 * (g.side ? 2 : 1) + (g.side ? T.switchSide : 0) });
          if (j === 0) steps.push({ type: 'pairgo', move: p[1], planned: T.toPair });
        });
        if (!(pi === GENTLE_PAIRS.length - 1 && r === 2)) steps.push({ type: 'rest', seconds: 30, planned: 30 });
      }
    });
    COOL.short.forEach(function (c, i) { steps.push({ type: 'cool', id: c.id, name: c.name, seconds: c.seconds, line: c.lineF || c.line, n: i + 1, of: COOL.short.length, planned: c.seconds }); });
    steps.push({ type: 'gentleq', planned: 30 });
    steps.push({ type: 'done', planned: 0 });
    var planned = steps.reduce(function (s, st) { return s + st.planned; }, 0);
    // her new moves' Learn screens (about 30 s each) count in the planned time, as in session5 (the rehearsal found them missing)
    var learnSec = steps.filter(function (st) { return st.type === 'set' && st.learnFirst; }).length * 30;
    if (learnSec) steps.learnSec = learnSec;
    return { gentle: true, n: 0, k: k, letter: '', block: 'gentle', blockName: 'Gentle start', line: 'Gentle start · session ' + k, length: 'one', who: 'f', pairs: [], moves: {}, steps: steps, planned: planned, ctx: {} };
  }

  // ============================================================= effort and moving up (program part 4)
  var TAPS = ['0', '1-2', '3+'];
  function tapOK(tap, block, who) {
    if (who === 'f' && tap === '0') return false;
    return TARGET[block] === '3+' ? tap === '3+' : (tap === '1-2' || tap === '3+');
  }
  /** A finding set (up to 30 reps, "until you could do about 3 more") → the change for next time. */
  function findingStep(reps, moveId) {
    var db = MOVES[moveId] && MOVES[moveId].ladder !== 'band' && MOVES[moveId].ladder !== 'press';
    if (reps >= 25) return db ? 2 : 'band';
    if (reps >= 18) return 1;
    if (reps >= 10) return 0;
    return -1;
  }
  /** Index of the next whole band (the next color at P1) on a band ladder. */
  function nextBand(lad, i) {
    var cur = lad[i] && lad[i].band;
    for (var k = i + 1; k < lad.length; k++) if (lad[k].band !== cur && (lad[k].pos || 1) === 1) return k;
    return Math.min(lad.length - 1, i + 1);
  }
  var NO_7DAY_UNTIL_7 = { box_squat: 1, squat15: 1, split_squat: 1, rfess: 1, hinge_drill: 1, pull_through: 1, db_rdl: 1, bstance_rdl: 1 };
  var ZERO_HOLDS = { squat: 1, split: 1, hinge: 1 };
  /**
   * One move's history → its state for the next session. sessions: oldest first, each
   *   { date, n, block, rung (index used), sets: [{reps, tap, wrong (true), pain, finding, calibrate, drop, near, chip}], who, swapped }
   * Each session's own rung is taken as fact (a past change never changes a rung a later session used).
   * → { rung, findings, lastUp, dropHold, holds, stuck, topBonus, upNext, note, justUp }
   */
  function moveState(moveId, sessions, ctx) {
    ctx = ctx || {};
    var m = MOVES[moveId] || {}, lad = ladderOf(moveId, ctx.eq);
    var st = { rung: startRung(moveId, ctx.who, ctx.eq, ctx.history), findings: 0, lastUp: '', dropHold: 0, holds: 0, stuck: 0, topBonus: 0, upNext: false, note: '', justUp: false, prevReps: null, sessions: 0, wrongStreak: 0 };
    (sessions || []).forEach(function (s) {
      var used = s.rung != null ? s.rung : st.rung;
      var sets = (s.sets || []).filter(function (x) { return !x.drop && !x.calibrate && x.reps != null; });
      st.sessions++;
      var base = used, next = used, note = '';
      var range = [m.range[0], m.range[1] + st.topBonus];
      if (moveId === 'calf_raise' && lad[used] && lad[used].single) range = [10, 15 + st.topBonus];
      var finding = sets.filter(function (x) { return x.finding; })[0];
      var wrong = sets.some(function (x) { return x.wrong; }) || sets.some(function (x) { return x.pain; });
      var allTop = sets.length && sets.every(function (x) { return +x.reps >= range[1]; });
      var below = sets.some(function (x) { return +x.reps < range[0]; }) || (ZERO_HOLDS[m.kind] && sets.some(function (x) { return x.tap === '0'; }));
      var lastTap = sets.length ? sets[sets.length - 1].tap : '';
      var allEasy = sets.length && sets.every(function (x) { return x.tap === '3+'; });
      var total = sets.reduce(function (a, x) { return a + (+x.reps || 0); }, 0);
      var sevenOK = !st.lastUp || L.daysBetween(st.lastUp, s.date) >= 7 || (NO_7DAY_UNTIL_7[moveId] && (s.n || 99) < 7);
      if (s.swappedTo != null) { next = s.swappedTo; note = 'swap'; }
      else if (finding && st.findings < 2) {
        st.findings++;
        var f = findingStep(+finding.reps, moveId);
        next = f === 'band' ? nextBand(lad, used) : Math.max(0, Math.min(lad.length - 1, used + f));
        note = next > used ? 'up' : (next < used ? 'down' : 'stay');
        st.justUp = next > used;
        if (next > used) st.lastUp = s.date;
      } else if (st.justUp && sets[0] && +sets[0].reps >= range[1] && sets[0].tap === '3+' && !wrong) {
        next = Math.min(lad.length - 1, used + 1); note = 'up'; st.lastUp = s.date; st.justUp = true; // just went up and still easy: up again
      } else {
        st.justUp = false;
        if (s.wrongTwice) { next = Math.max(0, used - 1); note = 'down'; st.holds = 0; } // the same wrong answer twice in a row: starts one easier
        else if (below) {
          st.holds++;
          if (st.holds >= 2) { next = Math.max(0, used - 1); note = 'down'; st.holds = 0; st.dropHold = 2; }
          else note = 'hold';
        } else {
          st.holds = 0;
          var qualifies = allTop && tapOK(lastTap, s.block, ctx.who) && !wrong && !(ctx.who === 'f' && s.gateStop && (m.region === 'lower' || m.region === 'core'));
          if (qualifies && st.dropHold > 0) { st.dropHold--; note = 'stay'; }
          else if (qualifies && sevenOK) {
            if (used >= lad.length - 1) { var cap = m.ladder === 'band' || m.ladder === 'press' ? 25 : 20; if (range[1] < cap) { st.topBonus = Math.min(cap - m.range[1], st.topBonus + 3); note = 'top'; } else note = 'stay'; }
            else { next = used + 1; note = 'up'; st.lastUp = s.date; st.justUp = true; }
          } else note = 'stay';
        }
      }
      // stuck: three sessions on the same rung with no added reps and taps of 1–2 or 3+
      if (next === used && note !== 'down' && st.prevReps != null && total <= st.prevReps && (lastTap === '1-2' || lastTap === '3+')) st.stuck++;
      else if (next !== used) st.stuck = 0;
      st.prevReps = next === used ? total : null;
      st.rung = next;
      st.note = note;
      st.lastDate = s.date;
      st.upNext = note === 'up';
      st.allEasy = allEasy && allTop;
      void base;
    });
    st.stuckNow = st.stuck >= 2; // the third session on the rung with no added reps → the next session's near-limit set
    return st;
  }
  /** During the set screen: every set so far at the top of the range with 3+ → "Moving up next time". */
  function movingUpNow(mv, sets) {
    if (!sets.length) return false;
    return sets.every(function (x) { return +x.reps >= mv.range[1] && x.tap === '3+' && !x.wrong && !x.pain; });
  }
  /** The hinge unlock: 2 hinge-drill sessions with no "Low back" and a back-of-thighs or glutes answer. */
  function hingeUnlocked(drillSessions) {
    var good = (drillSessions || []).filter(function (s) {
      var chips = (s.sets || []).map(function (x) { return x.chip || ''; });
      return chips.indexOf('Low back') < 0 && (chips.indexOf('Back of thighs') >= 0 || chips.indexOf('Glutes') >= 0);
    });
    return good.length >= 2;
  }
  /** Rules 2–3 within a session: the same wrong answer twice in a row → one rung easier; low back twice on a hinge or squat → the drill. */
  function inSession(moveId, sets) {
    var m = MOVES[moveId] || {}, out = { easier: 0, drill: false };
    var wrongs = sets.map(function (x) { return x.wrongKey || ''; });
    for (var i = 1; i < wrongs.length; i++) if (wrongs[i] && wrongs[i] === wrongs[i - 1]) out.easier = 1;
    var low = sets.filter(function (x) { return x.wrongKey === 'Low back:Tight or achy' || ((m.kind === 'squat' || m.kind === 'split') && x.wrongKey === 'Low back'); }).length;
    if (low >= 2 && (m.kind === 'hinge' || m.kind === 'squat' || m.kind === 'split')) out.drill = true;
    return out;
  }
  /** The drill rung a move falls back to (rule 3) and the swap for "This hurts" (part 6): {move, rung} */
  function drillFor(moveId) { var m = MOVES[moveId] || {}; return m.kind === 'hinge' ? { move: 'hinge_drill', rung: 1 } : { move: 'box_squat', rung: 0 }; }
  function swapFor(moveId, rungIndex) {
    switch (moveId) {
      case 'box_squat': case 'squat15': return { move: 'box_squat', rung: 0, line: 'Box squat to a chair instead.' };
      case 'split_squat': case 'rfess': return { move: 'box_squat', rung: 0, line: 'Box squat to a chair instead.' };
      case 'pull_through': case 'db_rdl': case 'bstance_rdl': return { move: 'hinge_drill', rung: 1, line: 'The hinge drill instead.' };
      case 'hinge_drill': return { move: 'bridge', rung: 0, line: 'Glute bridge instead.' };
      case 'pushup': return { move: 'pushup', rung: 0, line: 'Push-ups on the wall instead.' };
      case 'calf_raise': return { move: 'calf_raise', rung: 0, line: 'Both legs on the floor instead.' };
      case 'band_row': case 'pulldown': case 'face_pull': case 'chest_press': case 'pallof': return { move: moveId, rung: Math.max(0, (rungIndex || 0) - 1), line: 'Half a step closer, or a lighter band.' };
      default: return { move: moveId, rung: Math.max(0, (rungIndex || 0) - 1), line: 'One rung lighter, or skip it today.', skip: true };
    }
  }
  var WRIST_LINE = 'Wrist or thumb-side pain: push-ups on your fists or on dumbbell handles with straight wrists; band moves with a relaxed grip or the strap around your forearm. If it lasts 2 weeks, see a doctor or hand therapist.';

  // ============================================================= the program state from the logs (both phones and the back office)
  /**
   * o: { who, sets: R5 set rows [{workoutId, date, move, rung (index), rungKey, reps, tap, chip, follow, wrongKey, pain, flags}],
   *      workouts: R5 workout rows [{id, date, n, block, length, gentle, gate, gentleAnswers, makeup, lighter, swaps, minutes}],
   *      eq, today, start (the program start date), sick (Sick mode on), lightAt, gentleGo, physioGo }
   * → { n, block, letter, rungs, findings, learned, hingeUnlocked, stuck, topBonus, lastReps, states, gentle, gate, ... }
   */
  function programState(o) {
    o = o || {};
    var who = o.who === 'f' ? 'f' : 's';
    var ws = (o.workouts || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (String(a.ts || '') < String(b.ts || '') ? -1 : 1); });
    var prog = ws.filter(function (w) { return !w.gentle && w.n; });
    var gentle = ws.filter(function (w) { return w.gentle; });
    var byWorkout = {};
    (o.sets || []).forEach(function (x) { (byWorkout[x.workoutId] = byWorkout[x.workoutId] || []).push(x); });
    var lightAt = o.lightAt || 19;
    var bySessions = {}, learned = {}, drill = [];
    prog.forEach(function (w, i) {
      var n = i + 1;
      var block = blockOf(n, lightAt);
      var per = {};
      (byWorkout[w.id] || []).forEach(function (x) { learned[x.move] = true; (per[x.move] = per[x.move] || []).push(x); });
      Object.keys(per).forEach(function (id) {
        var sets = per[id].sort(function (a, b) { return (+a.setNo || 0) - (+b.setNo || 0); });
        var rung = sets[0].rung != null && sets[0].rung !== '' ? +sets[0].rung : null;
        var wrongTwice = inSession(id, sets).easier > 0;
        var swap = (w.swaps || {})[id];
        (bySessions[id] = bySessions[id] || []).push({ date: w.date, n: n, block: block, rung: rung, sets: sets.map(function (x) { return { reps: x.reps === '' || x.reps == null ? null : +x.reps, tap: String(x.tap || ''), wrong: !!x.wrongKey, wrongKey: x.wrongKey || '', chip: x.chip || '', pain: !!x.pain, finding: /finding/.test(x.flags || ''), calibrate: /calib/.test(x.flags || ''), drop: /drop/.test(x.flags || ''), setNo: +x.setNo || 0 }; }), wrongTwice: wrongTwice, swappedTo: swap != null ? swap : null, gateStop: !!w.gateStop });
        if (id === 'hinge_drill') drill.push({ sets: sets });
      });
    });
    gentle.forEach(function (w) { (byWorkout[w.id] || []).forEach(function (x) { learned[x.move] = true; }); });
    var history = {};
    var states = {}, rungs = {}, findings = {}, stuck = {}, topBonus = {}, lastReps = {};
    Object.keys(MOVES).forEach(function (id) {
      var ss = bySessions[id] || [];
      var stt = moveState(id, ss, { who: who, eq: o.eq, history: history });
      states[id] = stt;
      if (ss.length) rungs[id] = stt.rung;
      findings[id] = stt.findings;
      if (stt.stuckNow) stuck[id] = true;
      if (stt.topBonus) topBonus[id] = stt.topBonus;
      var last = ss[ss.length - 1];
      if (last) { var r = last.sets.map(function (x) { return x.reps; }).filter(function (x) { return x != null; }); if (r.length) lastReps[id] = Math.round(r.reduce(function (a, b) { return a + b; }, 0) / r.length); }
    });
    // harder versions start from where the build version got to
    var boxLad = ladderOf('box_squat', o.eq), boxTop = states.box_squat ? boxLad[states.box_squat.rung] : null;
    history.boxReached10 = !!(boxTop && boxTop.w >= 10);
    history.rdlReached3 = !!(states.db_rdl && states.db_rdl.rung >= 2);
    if (!rungs.squat15) rungs.squat15 = history.boxReached10 ? 2 : 0;
    if (!rungs.bstance_rdl) rungs.bstance_rdl = who === 'f' ? 0 : (history.rdlReached3 ? 1 : 0);
    var n = prog.length + 1;
    var block = blockOf(n, lightAt);
    if (!(bySessions.rfess || []).length) rungs.rfess = block === 'harder' && who === 's' && states.split_squat && states.split_squat.rung >= 3 ? 1 : 0;
    var lastDate = prog.length ? prog[prog.length - 1].date : (gentle.length ? gentle[gentle.length - 1].date : '');
    var gap = lastDate && o.today ? L.daysBetween(lastDate, o.today) : 0;
    // days that don't go to plan (part 7): welcome-back workouts
    var welcomeLeft = 0, welcomeLine = '';
    var lastBreak = 0;
    for (var i = 1; i < prog.length; i++) { var g = L.daysBetween(prog[i - 1].date, prog[i].date); if (g > 10) lastBreak = i; }
    if (prog.length && gap > 21) { welcomeLeft = 3; welcomeLine = 'Back at it. Here\'s where you left off.'; }
    else if (prog.length && gap > 10) { welcomeLeft = 1; welcomeLine = 'Back at it. Here\'s where you left off.'; }
    else if (o.afterSick && prog.length) welcomeLeft = 3;
    else if (lastBreak) {
      var gb = L.daysBetween(prog[lastBreak - 1].date, prog[lastBreak].date);
      var need = gb > 21 ? 3 : 1, since = prog.length - lastBreak;
      if (since < need) { welcomeLeft = need - since; welcomeLine = 'Back at it. Here\'s where you left off.'; }
    }
    return {
      who: who, n: n, block: block, letter: letterOf(n), line: blockLine(n, lightAt), lightAt: lightAt, done: prog.length, lastDate: lastDate, gap: gap,
      rungs: rungs, findings: findings, learned: learned, hingeUnlocked: hingeUnlocked(drill), drillSessions: drill.length, stuck: stuck, topBonus: topBonus, lastReps: lastReps, states: states, history: history,
      welcome: welcomeLeft > 0, welcomeLine: welcomeLine, gentle: gentleState(gentle, o), gate: gateState(prog, who), sessionsByMove: bySessions
    };
  }

  // ============================================================= hers: the gentle start and the symptom gate (part 10)
  /** answers per gentle session: { q1: 'no'|'little'|'yes', q2: 'yes'|'no', finished: true } */
  function gentleState(sessions, o) {
    o = o || {};
    var list = (sessions || []).map(function (w) { return w.answers || {}; });
    var k = list.length;
    var clear = function (a) { return a.q1 === 'no' && a.q2 === 'yes' && a.finished !== false; };
    var anyYes = list.some(function (a) { return a.q1 === 'yes'; });
    var lastYes = k && list[k - 1].q1 === 'yes';
    var done = false, why = '';
    if (o.physioGo) { done = true; why = 'physio'; }
    else if (k >= 3 && list.slice(0, 3).every(clear) && k === 3) { done = true; why = 'clear3'; }
    else if (k >= 3) {
      var run = 0;
      for (var i = k - 1; i >= 0 && clear(list[i]); i--) run++;
      if (run >= 3) { done = true; why = 'clear3'; }
      else if (k >= 6) {
        var last3 = list.slice(-3);
        if (!anyYes && !last3.some(function (a) { return a.q1 === 'yes'; }) && last3.filter(function (a) { return a.q1 === 'little'; }).length <= 1) { done = true; why = 'six'; }
      }
    }
    // after a "Yes" she stays until her physio or midwife says go, or 3 clear sessions in a row
    if (anyYes && why === 'six') done = false;
    return { sessions: k, done: done, why: why, physioCard: lastYes || (anyYes && !done), keepGentle: k >= 6 && !done, readyLine: done && why === 'clear3' ? 'Ready for the full program' : '' };
  }
  /** The symptom gate: today's answer is asked at the start; this is what the history says. */
  function gateState(prog, who) {
    if (who !== 'f') return { clear: true, stop: false, offRun: 0, goodRun: 99 };
    var answers = prog.map(function (w) { return w.gate || ''; }).filter(Boolean);
    var goodRun = 0, offRun = 0;
    for (var i = answers.length - 1; i >= 0; i--) { if (answers[i] === 'ok') goodRun++; else break; }
    for (var j = answers.length - 1; j >= 0; j--) { if (answers[j] === 'off') offRun++; else break; }
    // twice in a row: lower-body and core moves stop moving up until 3 workouts in a row of All good
    var stop = false, sinceStop = 0;
    for (var a = 0; a < answers.length; a++) {
      if (answers[a] === 'off' && a > 0 && answers[a - 1] === 'off') { stop = true; sinceStop = 0; }
      else if (stop && answers[a] === 'ok') { sinceStop++; if (sinceStop >= 3) stop = false; }
      else if (stop) sinceStop = 0;
    }
    return { clear: goodRun >= 3, stop: stop, offRun: offRun, goodRun: goodRun };
  }

  // ============================================================= days that don't go to plan (part 7)
  var TRAIN_DAYS = { 0: true, 2: true, 4: true }; // Sunday, Tuesday, Thursday
  /**
   * What today is for the program. o: { today, minutes, lastDates (program workout dates, newest last), cal (the calendar), started (program start),
   *   makeupThisWeek (bool), restDay (Shabbat/Yom Tov), fast }
   * → { kind: 'train'|'makeup'|'rest'|'notyet', missed (date), shortOnly, late, line }
   */
  function dayKind(o) {
    var d = o.today, wd = L.weekday(d);
    var lateLine = (o.minutes || 0) >= 20 * 60 ? 'Late tonight? Regular or Short is easier on sleep.' : '';
    if (o.started && d < o.started) return { kind: 'notyet', late: lateLine, line: 'Your new program starts ' + L.WEEKDAYS[L.weekday(o.started)] + '.' };
    if (o.restDay) return { kind: 'rest', late: '' };
    if (o.fast) return { kind: 'fast', late: '' };
    var doneToday = (o.lastDates || []).indexOf(d) >= 0;
    if (TRAIN_DAYS[wd]) return { kind: 'train', late: lateLine, done: doneToday };
    var y = L.addDays(d, -1);
    var ywd = L.weekday(y);
    var did = (o.lastDates || []).indexOf(y) >= 0;
    var started = !o.started || y >= o.started;
    // a make-up day: Monday for Sunday, Wednesday for Tuesday, Friday (Short only) for Thursday
    if (TRAIN_DAYS[ywd] && !did && started && !o.makeupThisWeek && !(o.yRest)) {
      // never 3 training days in a row
      var d2 = L.addDays(d, -2), d3 = L.addDays(d, 1);
      var three = (o.lastDates || []).indexOf(d2) >= 0 && TRAIN_DAYS[L.weekday(d3)];
      if (!three) return { kind: 'makeup', missed: y, shortOnly: wd === 5, late: lateLine, done: doneToday, line: 'Missed yesterday\'s workout? Do it today.' };
    }
    return { kind: 'off', late: lateLine, done: doneToday };
  }
  /** The ready score (part 7): under 6 hours of sleep or energy 2 or less → lighter (one set fewer, one rung lighter). */
  function lighterToday(o) {
    if (o.manual === true) return { on: true, why: 'manual' };
    if (o.manual === false) return { on: false, why: 'off' };
    var low = (o.sleep != null && +o.sleep < 6) || (o.energy != null && +o.energy <= 2);
    return { on: !!low, why: low ? 'ready' : '' };
  }
  /** Run down in the Build block: Sick mode or "Make today lighter" twice in one week during workouts 13–18 → offer the Light week early. */
  function offerEarlyLight(o) { return o.n >= 13 && o.n <= 18 && (o.sick || (o.lighterThisWeek || 0) >= 2) && !(o.lightAt && o.lightAt < 19); }

  // ============================================================= personal times (part 9)
  function median(a) { a = a.filter(function (x) { return isFinite(x) && x > 0; }).sort(function (p, q) { return p - q; }); if (!a.length) return null; var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  /** After 3 workouts, the person's own pace: {pace (actual ÷ planned set time), setup (actual ÷ planned setup)} */
  function personalMedians(workouts) {
    var ws = (workouts || []).filter(function (w) { return w.n && w.times; });
    if (ws.length < 3) return null;
    var pace = [], setup = [];
    ws.forEach(function (w) { (w.times.sets || []).forEach(function (x) { if (x.planned > 0 && x.actual > 0) pace.push(x.actual / x.planned); }); (w.times.setups || []).forEach(function (x) { if (x.planned > 0 && x.actual > 0) setup.push(x.actual / x.planned); }); });
    var p = median(pace), s = median(setup);
    return { pace: p ? Math.max(0.6, Math.min(2, p)) : 1, setup: s ? Math.max(0.5, Math.min(2.5, s)) : 1 };
  }

  // ============================================================= walking (part 11) and her protein (part 10)
  /** steps: [{date, steps}] from iPhone Health; rest: {date: true} for Shabbat/Yom Tov (no data, not zero). */
  function stepGoal(o) {
    var rest = o.rest || {}, today = o.today;
    var by = {};
    (o.steps || []).forEach(function (s) { if (s.date && !rest[s.date] && +s.steps > 0 && s.date <= today) by[s.date] = Math.max(by[s.date] || 0, +s.steps); });
    var days = Object.keys(by).sort();
    if (days.length < 14) return { baseline: null, goal: null, avg7: avgLast(by, days, today, 7), recorded: days.length, need: 14 - days.length };
    var baseline = Math.round(median(days.slice(0, 14).map(function (d) { return by[d]; })) / 100) * 100;
    var goal = baseline > 10000 ? baseline : Math.min(11000, baseline + 1000), hold = baseline > 10000;
    var setOn = days[13], raises = [];
    // every 2 weeks: up 1,000 if the 7-day average met the goal on at least 8 of the last 14 recorded days
    for (var check = L.addDays(setOn, 14); check <= today && !hold && goal < 11000; check = L.addDays(check, 14)) {
      var recent = days.filter(function (d) { return d > L.addDays(check, -14) && d <= check; }).slice(-14);
      var met = recent.filter(function (d) { return avgLast(by, days, d, 7) >= goal; }).length;
      if (met >= 8) { goal = Math.min(11000, goal + 1000); raises.push(check); }
    }
    return { baseline: baseline, goal: goal, avg7: avgLast(by, days, today, 7), recorded: days.length, raises: raises, held: hold || goal >= 11000 };
  }
  /** The average of the last 7 recorded days up to a date (rest days are skipped, not zero). */
  function avgLast(by, days, upTo, k) {
    var d = days.filter(function (x) { return x <= upTo; }).slice(-k);
    return d.length ? Math.round(d.reduce(function (a, x) { return a + by[x]; }, 0) / d.length) : null;
  }
  /** Weekly active minutes by weeks since the program started (part 11). who 's' | 'f'. */
  function minutesGoal(who, weekNo) {
    if (who === 'f') return weekNo >= 7 ? 175 : 150;
    return weekNo >= 10 ? 275 : weekNo >= 7 ? 250 : weekNo >= 4 ? 200 : 150;
  }
  function programWeek(start, date) { return start && date >= start ? Math.floor(L.daysBetween(L.weekStart(start), L.weekStart(date)) / 7) + 1 : 1; }
  /** Her protein (part 10): 1.3–1.6 g per kg, at least 80 g, aiming for about 100 g; from her goal weight if she has a lot to lose. */
  function nursingProtein(o) {
    var w = +o.weight || 0, goal = +o.goal || 0;
    var basis = goal && w - goal > 25 ? goal : (w || goal);
    if (!basis) return { grams: 100, low: 80, high: 110, basis: 'default' };
    var kg = basis / 2.20462;
    var low = Math.max(80, Math.round(1.3 * kg / 5) * 5), high = Math.max(low, Math.round(1.6 * kg / 5) * 5);
    var grams = Math.max(80, Math.min(high, Math.max(low, 100)));
    return { grams: grams, low: low, high: high, basis: basis === goal && goal !== w ? 'goal' : 'current' };
  }
  var PELVIC = {
    title: 'Pelvic floor',
    text: '10 slow squeezes, hold up to 10 s, rest as long; then 8 quick ones. Breathe out as you squeeze, relax fully after each. 2–3 times a day. Squeeze before you cough, sneeze or lift your daughter.',
    tip: 'A check with a pelvic health physio is worth it after children, even with no symptoms.'
  };
  var HER_START_LINE = 'Nurse or pump first if you can, water nearby, a comfortable bra.';
  var KIDNEY_LINE = 'If you have any kidney problem, ask your doctor before raising protein.';
  var PHYSIO_CARD = { title: 'See a pelvic health physio', text: 'Leaking, heaviness or a bulge, pain with intimacy, or pelvic or back pain that stays is worth a check with a pelvic health physio. It\'s common after children and very treatable.', go: 'My physio or midwife said go' };

  // ============================================================= the voice lines a workout can say (all fixed, all in files)
  var SAY5 = {
    words: ['Down', 'Up', 'Pull', 'Push', 'Press', 'Back', 'Reach', 'Squeeze', 'Hold', 'Pause', 'two', 'three', 'four', 'five', 'six'],
    count: ['3', '2', '1'],
    effort: 'How many more good reps could you have done?',
    where: 'Where did you feel it most?',
    top: 'That\'s the top of the range. Tap Done when you finish.',
    finding: 'This set is a test. Keep going until you could do about 3 more.',
    calibrate: 'This set, keep going until you can\'t do one more clean rep.',
    calibrated: 'That\'s what 0 left feels like.',
    near: 'This set, go until you could do only one more.',
    dropSet: 'Step one position closer and keep going until 0 left.',
    rest: 'Rest.', restThen: 'Rest, then the next set.', nextUp: 'Next up.', lastSet: 'Last set.', switchSides: 'Switch sides.', otherSide: 'Other side.',
    setup: 'Set up for the next pair.', anchorChest: 'Move the anchor to chest height.', anchorLow: 'Move the anchor low.', anchorTop: 'Move the anchor to the top of the door.',
    warmup: 'Warm-up.', cooldown: 'Cool-down. Skip it if you need to; the workout counts either way.', done: 'Workout done.', halfway: 'Halfway.',
    welcome: 'Back at it. Here\'s where you left off.', lighter: 'Lighter today: one set fewer and one rung lighter.', breathe: 'Breathe out on the effort. Never hold your breath.',
    set: function (k) { return 'Set ' + k + '.'; }
  };
  /** Every fixed sentence the workouts can say: tools/voice-lines.js makes a file per voice for each. */
  function voiceLines5() {
    var out = [], seen = {};
    var add = function (t, cue) { if (t && !seen[t]) { seen[t] = 1; out.push({ text: t, cue: !!cue }); } };
    SAY5.words.forEach(function (w) { add(w, true); });
    SAY5.count.forEach(function (w) { add(w, true); });
    ['effort', 'where', 'top', 'finding', 'calibrate', 'calibrated', 'near', 'dropSet', 'rest', 'restThen', 'nextUp', 'lastSet', 'switchSides', 'otherSide', 'setup', 'anchorChest', 'anchorLow', 'anchorTop', 'warmup', 'cooldown', 'done', 'halfway', 'welcome', 'lighter', 'breathe'].forEach(function (k) { add(SAY5[k]); });
    [2, 3].forEach(function (k) { add(SAY5.set(k)); });
    Object.keys(MOVES).forEach(function (id) {
      var m = MOVES[id];
      add(m.name + '.');
      if (m.first) add(m.first + '.');
      add(m.setup);
      add(m.squeeze + '.');
      var f = FEEL[feelKind(id)];
      Object.keys(f.cue).forEach(function (c) { add(cap1(f.cue[c]) + '.'); });
      Object.keys(f.wrong).forEach(function (c) { add(f.wrong[c][1]); });
    });
    Object.keys(GENTLE).forEach(function (id) {
      var g = GENTLE[id]; add(g.name + '.'); add(g.setup);
      if (g.kind) { var fg = FEEL[g.kind]; Object.keys(fg.cue).forEach(function (c) { add(cap1(fg.cue[c]) + '.'); }); Object.keys(fg.wrong).forEach(function (c) { add(fg.wrong[c][1]); }); } // her moves' fixes (audit B2)
    });
    add('Heel slides.'); add('Dead bug, legs only.');
    WARM.s.concat(WARM.f, WARM.both).forEach(function (w) { add(w.line); if (w.lineF) add(w.lineF); });
    COOL.regular.concat(COOL.short).forEach(function (c) { add(c.line); if (c.lineF) add(c.lineF); });
    add('Breathing with the pelvic floor. Breathe in through your nose and let the belly soften. A long sigh out.');
    return out;
  }

  /** 7.9: the photo of an imported recipe, from the page's JSON-LD ("image": a link, a list, or an ImageObject). https only. */
  function recipeImage(html) {
    var out = '';
    String(html || '').replace(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, function (_, json) {
      if (out) return '';
      var j = null;
      try { j = JSON.parse(json); } catch (e) { return ''; }
      (function walk(o) {
        if (!o || out || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        var t = o['@type'];
        if (t === 'Recipe' || (Array.isArray(t) && t.indexOf('Recipe') >= 0)) {
          var im = o.image; if (Array.isArray(im)) im = im[0]; if (im && typeof im === 'object') im = im.url || im.contentUrl;
          if (/^https:\/\//.test(String(im || ''))) out = String(im);
          return;
        }
        if (o['@graph']) walk(o['@graph']);
      })(j);
      return '';
    });
    return out;
  }

  var R5 = {
    appDay: appDay, stillLine: stillLine, DAY_ENDS: DAY_ENDS, recipeImage: recipeImage,
    MOVES5: MOVES, GENTLE5: GENTLE, GENTLE_PAIRS: GENTLE_PAIRS, DOOR_ANCHOR: DOOR_ANCHOR, WARM_VIDEO: WARM_VIDEO, PULLAPART_VIDEO: PULLAPART_VIDEO, AB_CHECK_VIDEO: AB_CHECK_VIDEO,
    CHIPS: CHIPS, FEEL: FEEL, FOLLOW: FOLLOW, feelKind: feelKind, chipsFor: chipsFor, chipsFirst: chipsFirst, followFor: followFor, feelVerdict: feelVerdict,
    dumbbells: dumbbells, rungsFor: rungsFor, ladderOf: ladderOf, startRung: startRung, keyIndex: keyIndex,
    WORKOUTS: WORKOUTS, HARDER: HARDER, BLOCK_NAMES: BLOCK_NAMES, TARGET: TARGET, letterOf: letterOf, blockOf: blockOf, weekOf: weekOf, blockLine: blockLine,
    TIMING: T, repSeconds: repSeconds, beats: beats, WARM5: WARM, COOL5: COOL, session5: session, gentleSession: gentleSession, timeLeft: timeLeft, plannedTotal: plannedTotal,
    TAPS: TAPS, tapOK: tapOK, findingStep: findingStep, nextBand: nextBand, moveState: moveState, movingUpNow: movingUpNow, hingeUnlocked: hingeUnlocked, inSession: inSession,
    drillFor: drillFor, swapFor: swapFor, WRIST_LINE: WRIST_LINE, programState: programState, gentleState: gentleState, gateState: gateState,
    dayKind5: dayKind, lighterToday: lighterToday, offerEarlyLight: offerEarlyLight, median: median, personalMedians: personalMedians,
    stepGoal: stepGoal, minutesGoal: minutesGoal, programWeek: programWeek, nursingProtein: nursingProtein,
    PELVIC: PELVIC, HER_START_LINE: HER_START_LINE, KIDNEY_LINE: KIDNEY_LINE, PHYSIO_CARD: PHYSIO_CARD, SAY5: SAY5, voiceLines5: voiceLines5
  };
  Object.keys(R5).forEach(function (k) { L[k] = R5[k]; });
  return L;
});
