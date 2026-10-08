/*
 * Our Plan — built-in content (shared by the app and the Apps Script backend).
 * Everything here is real, curated content. Video IDs were verified with YouTube oEmbed
 * (see tools/verify-links.js); supplement claims cite the sources in SOURCES.
 * The coach can add more items at runtime; those live in the Google Sheet, not here.
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) { module.exports = lib; }
  else { root.OurPlanContent = lib; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ------------------------------------------------------------------ videos
  // id -> {id, title, channel}. Verified with https://www.youtube.com/oembed (HTTP 200).
  var VIDEOS = {/*VIDEOS_START*/
    push_1: {id: "IBmBttR_HVI",title: "You've Been Doing Push Ups WRONG! | How To Do Wall Push Ups",channel: "Rehab and Revive",backup: {id: "5NPvv40gd3Q",title: "6: Push-ups against a wall",channel: "Sunnybrook Hospital"}},
    push_2: {id: "76TQU7iZlsI",title: "The Incline Push Up | How To Perform | What To Avoid",channel: "Dr. Carl Baird",backup: {id: "GDTFPZFz960",title: "Counter Push Up Exercise",channel: "Husky Orthopaedics"}},
    push_3: {id: "WcHtt6zT3Go",title: "Wellness Wednesday: Give yourself 10 knee push-ups",channel: "Mayo Clinic",backup: {id: "lFR1GWy1Dcs",title: "The Knee Push Up | How To Perform Without Shoulder Pain",channel: "Dr. Carl Baird"}},
    push_4: {id: "TDmg3tFGOvE",title: "How to Do a Push Up | Step by Step for Beginners",channel: "Rehab and Revive",backup: {id: "bEPBnglTdkA",title: "The Perfect Push Up | Push Patterning",channel: "Dr. Carl Baird"}},
    squat_1: {id: "vOWUSGvoCgg",title: "The Assisted Sit to Stand | Beginner Squat Variation For Anyone With Bad Knees",channel: "Dr. Carl Baird",backup: {id: "tpQvpRGQR88",title: "Sit to Stand Using the Arms of a Chair",channel: "Midlands Partnership University NHS FT"}},
    squat_2: {id: "ITv-_BkcrD0",title: "Sit to Stand",channel: "Baptist Health",backup: {id: "2rVOvOU_vmE",title: "Falls Prevention: Sit to Stand - No Hands",channel: "Rehab My Patient"}},
    squat_3: {id: "8uoaYwS6iFM",title: "Squat (Bodyweight) | Fit for the 500 | IU Health Sports Performance",channel: "IU Health",backup: {id: "KJ8xAMJdZjQ",title: "Physical Therapist Shows Proper Squat Form",channel: "Center For Total Back Care"}},
    squat_4: {id: "qNPVjehTyKA",title: "The Tempo Squat | Squat Progressions",channel: "Dr. Carl Baird",backup: {id: "P9Hxs237fVQ",title: "Tempo Squats",channel: "Matthew Stevens"}},
    squat_5: {id: "rVwJlgO_TWY",title: "How To Do The Goblet Squat w/ Good Form  | Advanced Squat Variation",channel: "Dr. Carl Baird",backup: {id: "nfX7IFK9UNI",title: "How to do a Goblet Squat  | Proper Form & Technique | NASM",channel: "National Academy of Sports Medicine (NASM)"}},
    calf_1: {id: "A_npfqG65vs",title: "Plantar Fascia Standing Heel Raises",channel: "NHS Ayrshire & Arran",backup: {id: "dV4Yjv-gsyY",title: "Standing Heel Raises Stretch - Physical Therapy Exercises",channel: "TSAOG Orthopaedics & Spine"}},
    calf_2: {id: "qPd73snQfUs",title: "Single-Leg Calf Raise (HSS)",channel: "Hospital for Special Surgery",backup: {id: "2fiF2Ku8Y_U",title: "Single Leg Heel Raise",channel: "E3 Rehab Exercise Library"}},
    hinge_1: { id: 'wyop1jrpG18', title: 'Three Point Hip Hinge | Hip Hinge Patterning', channel: 'Dr. Carl Baird', backup: { id: 'mg35BfA-0ZM', title: 'Deadlift (Hip Hinge) Drill with a Stick | LeBauerPT Greensboro, NC', channel: 'LeBauer Physical Therapy, LLC' } },
    hinge_2: { id: 'nuapk_-Q2BI', title: 'How To Do A Glute Bridge | Step By Step Instruction For Beginners', channel: 'Dr. Carl Baird', backup: { id: 'PhTDzR0TpZs', title: 'How to Do a Glute Bridge Exercise: A Guide from Physical Therapists', channel: 'Hinge Health' } },
    hinge_3: { id: 'b1zTCyGJXCQ', title: 'Single Leg Glute Bridge Exercise | How To Perform And Common Mistakes', channel: 'Dr. Carl Baird', backup: { id: 'd3dsONgXDmY', title: 'Single leg bridge exercise | Ohio State Medical Center', channel: 'Ohio State Wexner Medical Center' } },
    hinge_4: { id: 'ERZzCKpjEDg', title: 'How To Do Romanian Deadlifts w/ Kettlebells (Without Back Pain!)', channel: 'Dr. Carl Baird', backup: { id: 'uUjqvxEWcbo', title: 'Dumbbell Romanian Deadlift (RDL) | TECHNIQUE for Beginners', channel: 'Mobility Doc' } },
    pull_1: { id: 'c-T5gqEtrWs', title: 'LiveHealthy at Home Full-body Workout: Door Frame Row', channel: 'Lake Health', backup: { id: 'r8NzhNe9Res', title: 'Door Frame Rows', channel: 'Sul Ross State Sports Performance' } },
    pull_2: { id: 'h06ydA-aY8M', title: 'How To Do Banded Rows for Pain-Free Shoulders (Beginner Friendly)', channel: 'Dr. Carl Baird', backup: { id: 'qykwviNOIyc', title: 'How to do a Standing Tubing Row', channel: 'National Academy of Sports Medicine (NASM)' } },
    pull_3: { id: 'nYFjVJqMmM8', title: 'How To Do The Single Arm Dumbbell Row | Avoid Common Mistakes For Less Shoulder And Neck Pain', channel: 'Dr. Carl Baird', backup: { id: '6KNmHxw-SpE', title: 'Single Arm Dumbbell Row | Nuffield Health', channel: 'Nuffield Health' } },
    carry_1: { id: 'y-hn_Ha1-RE', title: 'How To Perform The Suitcase Carry', channel: 'Dr. Carl Baird', backup: { id: 'LJaq4BS7KpE', title: 'The Best Core Exercise You\'re Not Doing', channel: 'Squat University' } },
    carry_2: { id: 'z7E_YU9P1jU', title: 'How to Perform the Farmer’s Carry', channel: 'Dr. Carl Baird', backup: { id: 'X72HhVGAko4', title: 'I LOVE Farmer Walks!', channel: 'Squat University' } },
    core_1: { id: '8NBNM8haZx0', title: 'Physical Therapy - Dead Bug Exercise', channel: 'ChoosePT', backup: { id: 'cnBYCszEoWQ', title: 'Dead Bug Exercises', channel: 'Bob & Brad' } },
    core_2: { id: 'ww-6lRXvI9Y', title: 'Physical Therapy - Bird Dog Exercise', channel: 'ChoosePT', backup: { id: '-f8OZr1IdTM', title: 'Try The Bird Dog Exercise for Beginners #shorts', channel: 'Bob & Brad' } },
    core_3: { id: 'iB3aVW6CauM', title: 'Basic Knee Plank', channel: 'Campbell Clinic Orthopaedics', backup: { id: 'Of0YDiN9p00', title: 'The Knee Plank | Plank Progressions', channel: 'Dr. Carl Baird' } },
    core_4: { id: 'bSLuhcYo6O0', title: 'The Right Way to Do a Plank', channel: 'Hospital for Special Surgery', backup: { id: '3QZlgJ40LfU', title: 'Demonstration of a Forearm Plank', channel: 'Hospital for Special Surgery' } },
    core_5: { id: 'jgQ49dXfznk', title: 'Plank with Shoulder Taps - Moving through Cancer – Penn State College of Medicine', channel: 'Penn State Health', backup: { id: 'gKA5LBy7WAI', title: 'How To Properly Do a Plank with Shoulder Taps - Strength Exercises - Wellen', channel: 'Wellen' } },
    warmup: { id: 'b2DYU7ZQgN0', title: 'Standing Warm-Up Routine For Seniors (Do before undertaking exercise) | More Life Health', channel: 'More Life Health Seniors', backup: { id: 'utBERF6BPxQ', title: 'Dynamic Stretches To Warm Up Your Whole Body | 5 Minutes', channel: 'Renew Medical Fitness' } },
    cooldown: { id: 'oFfKV6__QFs', title: '5-Minute Cool Down Routine for Post-Workout Recovery | WebMD', channel: 'WebMD', backup: { id: 'Mi0linstbYc', title: 'Follow Along 3-Minute Dynamic Stretching Cool-Down (End every workout like this!)', channel: 'Renew Medical Fitness' } },
    walking: { id: '-fD2TSL2s7I', title: 'Physical Therapist Shows How To Walk Correctly', channel: 'Rehab and Revive', backup: { id: '2SiZzfHanQY', title: 'Walking and Running Right-Mayo Clinic', channel: 'Mayo Clinic' } }
  /*VIDEOS_END*/};

  function yt(q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }

  // ---------------------------------------------------------------- exercises
  // unit: reps | seconds. low/high = target range per set. perSide = count each side.
  var EXERCISES = [
    // PUSH
    { id: 'push_1', pattern: 'push', level: 1, name: 'Wall push-up', unit: 'reps', low: 8, high: 15,
      cue: 'Hands on the wall at shoulder height, a little wider than your shoulders. Step back so you lean in, body straight from head to heels. Bend your elbows to bring your chest toward the wall, then press away.',
      feel: 'Chest, front of the shoulders and the back of your arms.',
      mistakes: ['Hips sagging or sticking out', 'Elbows flared straight out to the sides', 'Standing so close it is too easy'],
      saferId: null, harderId: 'push_2', search: 'wall push up proper form' },
    { id: 'push_2', pattern: 'push', level: 2, name: 'Countertop push-up', unit: 'reps', low: 8, high: 12,
      cue: 'Hands on the edge of a sturdy kitchen counter. Walk your feet back until your body is one straight line. Lower your chest to the edge with elbows angled back, then press up.',
      feel: 'Chest and arms, with your stomach working to keep you straight.',
      mistakes: ['Bending only at the hips', 'Dropping the head', 'Rushing the way down'],
      saferId: 'push_1', harderId: 'push_3', search: 'incline push up kitchen counter' },
    { id: 'push_3', pattern: 'push', level: 3, name: 'Knee push-up', unit: 'reps', low: 6, high: 12,
      cue: 'Hands under your shoulders, knees on a mat or towel, body straight from head to knees. Lower your chest toward the floor with elbows angled back, then press up.',
      feel: 'Chest, shoulders and back of the arms.',
      mistakes: ['Hips piked up in the air', 'Half reps', 'Lower back sagging'],
      saferId: 'push_2', harderId: 'push_4', search: 'knee push up proper form' },
    { id: 'push_4', pattern: 'push', level: 4, name: 'Full push-up', unit: 'reps', low: 5, high: 12,
      cue: 'Hands under your shoulders, on your toes, body in a straight plank. Lower as one piece until your chest is a fist from the floor, then push the floor away.',
      feel: 'Chest, shoulders, arms and your whole middle.',
      mistakes: ['Hips sagging', 'Elbows flared out wide', 'Head dropping toward the floor'],
      saferId: 'push_3', harderId: null, search: 'push up proper form physical therapist' },
    // SQUAT
    { id: 'squat_1', pattern: 'squat', level: 1, name: 'Sit-to-stand, with hands', unit: 'reps', low: 8, high: 12,
      cue: 'Sit at the front of a sturdy chair with its back against a wall. Feet flat, hip-width apart. Lean forward, push through your heels and use your hands on your thighs to stand tall. Sit back down slowly.',
      feel: 'Front of the thighs and your seat.',
      mistakes: ['Knees falling inward', 'Dropping into the chair', 'Feet too far forward'],
      saferId: null, harderId: 'squat_2', search: 'sit to stand exercise with hands physical therapy' },
    { id: 'squat_2', pattern: 'squat', level: 2, name: 'Sit-to-stand, no hands', unit: 'reps', low: 8, high: 12,
      cue: 'Sit on a sturdy chair, arms crossed over your chest or reaching forward. Stand up without using your hands, then take three slow seconds to sit back down.',
      feel: 'Thighs and seat working harder on the way down.',
      mistakes: ['Rocking to get up', 'Knees caving in', 'Plopping down at the end'],
      saferId: 'squat_1', harderId: 'squat_3', search: 'chair stand exercise no hands' },
    { id: 'squat_3', pattern: 'squat', level: 3, name: 'Bodyweight squat', unit: 'reps', low: 10, high: 15,
      cue: 'Feet shoulder-width, toes turned out a little. Sit your hips back and down as if reaching for a chair, chest proud, knees tracking over your toes. Go as low as you can with heels down, then stand.',
      feel: 'Thighs and seat.',
      mistakes: ['Heels lifting', 'Knees caving in', 'Rounding the back at the bottom'],
      saferId: 'squat_2', harderId: 'squat_4', search: 'bodyweight squat proper form physical therapist' },
    { id: 'squat_4', pattern: 'squat', level: 4, name: 'Tempo squat', unit: 'reps', low: 8, high: 12,
      cue: 'A bodyweight squat in slow motion: take three seconds to lower, pause for one second at the bottom, then stand up normally.',
      feel: 'Thighs burning by the last reps — that is the point.',
      mistakes: ['Speeding up when it gets hard', 'Losing balance at the bottom', 'Holding your breath'],
      saferId: 'squat_3', harderId: 'squat_5', search: 'tempo squat slow eccentric' },
    { id: 'squat_5', pattern: 'squat', level: 5, name: 'Goblet squat', unit: 'reps', low: 8, high: 12,
      cue: 'Hold a dumbbell, a full water jug or a heavy bag against your chest with both hands. Squat down with elbows inside your knees, then drive up through your whole foot.',
      feel: 'Thighs, seat and upper back holding the weight.',
      mistakes: ['Weight drifting away from the chest', 'Heels lifting', 'Rounding forward'],
      saferId: 'squat_4', harderId: null, search: 'goblet squat proper form' },
    // HINGE
    { id: 'hinge_1', pattern: 'hinge', level: 1, name: 'Hip hinge with a broomstick', unit: 'reps', low: 8, high: 12,
      cue: 'Hold a broomstick along your back so it touches the back of your head, upper back and tailbone. Soft knees. Push your hips back while your chest tips forward, keeping all three points on the stick. Stop at a stretch in the back of your thighs, then squeeze your seat to stand.',
      feel: 'A stretch in the back of the thighs; your seat on the way up.',
      mistakes: ['Rounding the back (the stick leaves your head or tailbone)', 'Squatting down instead of pushing the hips back', 'Locked knees'],
      saferId: null, harderId: 'hinge_2', search: 'hip hinge dowel drill' },
    { id: 'hinge_2', pattern: 'hinge', level: 2, name: 'Glute bridge', unit: 'reps', low: 10, high: 15,
      cue: 'Lie on your back, knees bent, feet flat and hip-width, heels close to your seat. Press through your heels and lift your hips until knees, hips and shoulders line up. Squeeze, pause one second, lower slowly.',
      feel: 'Your seat and the back of your thighs — not your lower back.',
      mistakes: ['Arching the lower back at the top', 'Pushing through the toes', 'Rushing'],
      saferId: 'hinge_1', harderId: 'hinge_3', search: 'glute bridge physical therapist' },
    { id: 'hinge_3', pattern: 'hinge', level: 3, name: 'Single-leg glute bridge', unit: 'reps', low: 8, high: 12, perSide: true,
      cue: 'Set up like a bridge, then straighten one leg in the air. Press through the planted heel and lift, keeping your hips level. Lower slowly. Finish one side, then switch.',
      feel: 'The seat on the working side.',
      mistakes: ['One hip dropping', 'Pushing through the toes', 'Arching the back'],
      saferId: 'hinge_2', harderId: 'hinge_4', search: 'single leg glute bridge form' },
    { id: 'hinge_4', pattern: 'hinge', level: 4, name: 'Romanian deadlift with household weight', unit: 'reps', low: 8, high: 12,
      cue: 'Hold dumbbells, a loaded backpack by its straps, or two full water jugs in front of your thighs. Soft knees. Push your hips back and slide the weight down your thighs with a flat back until you feel a stretch, about knee level. Squeeze your seat to stand tall.',
      feel: 'Back of the thighs and your seat.',
      mistakes: ['Rounding the back', 'The weight drifting away from your legs', 'Bending the knees so much it becomes a squat'],
      saferId: 'hinge_3', harderId: null, search: 'romanian deadlift dumbbell beginner form' },
    // PULL
    { id: 'pull_1', pattern: 'pull', level: 1, name: 'Doorway row', unit: 'reps', low: 8, high: 12,
      cue: 'Stand in a solid doorway and hold both sides of the frame at chest height. Feet close to the frame, lean back with straight arms and a straight body. Pull your chest toward the frame by squeezing your shoulder blades together, then lower slowly. Walk your feet closer to make it harder.',
      feel: 'Upper back, between the shoulder blades, and the front of the arms.',
      mistakes: ['Shrugging the shoulders up to the ears', 'Hips sagging', 'Jerking instead of pulling smoothly'],
      saferId: null, harderId: 'pull_2', search: 'door frame row exercise', safety: 'Use a solid door frame only — never a door that can swing.' },
    { id: 'pull_2', pattern: 'pull', level: 2, name: 'Band row', unit: 'reps', low: 10, high: 15,
      cue: 'Anchor a resistance band at chest height (closed in a door with a door anchor), or sit with legs straight and loop it around your feet. Pull the handles to your ribs, elbows close to your sides, squeeze your shoulder blades, then return slowly.',
      feel: 'Upper back and the back of the shoulders.',
      mistakes: ['Shrugging', 'Leaning back to cheat the pull', 'Letting the band snap back'],
      saferId: 'pull_1', harderId: 'pull_3', search: 'resistance band row form' },
    { id: 'pull_3', pattern: 'pull', level: 3, name: 'Backpack row', unit: 'reps', low: 8, high: 12, perSide: true,
      cue: 'Put one hand and one knee on a sturdy chair or bench. Hold a loaded backpack, a full jug or a dumbbell in the other hand, arm hanging. Pull it toward your hip, elbow close to your side, then lower slowly. Switch sides.',
      feel: 'The big muscle along the side of your back.',
      mistakes: ['Twisting the body to lift', 'Pulling with the hand instead of the elbow', 'Rounded back'],
      saferId: 'pull_2', harderId: null, search: 'one arm dumbbell row form' },
    // CORE
    { id: 'core_1', pattern: 'core', level: 1, name: 'Dead bug', unit: 'reps', low: 6, high: 10, perSide: true,
      cue: 'Lie on your back, arms straight up, knees bent above your hips. Press your lower back gently into the floor. Slowly reach one arm overhead and the opposite leg out long, then come back. Switch sides.',
      feel: 'Deep stomach muscles working to keep your back still.',
      mistakes: ['Lower back arching off the floor', 'Moving too fast', 'Holding your breath'],
      saferId: null, harderId: 'core_2', search: 'dead bug exercise physical therapy' },
    { id: 'core_2', pattern: 'core', level: 2, name: 'Bird-dog', unit: 'reps', low: 6, high: 10, perSide: true,
      cue: 'On hands and knees, hands under shoulders, knees under hips. Reach one arm forward and the opposite leg back until both are level with your body. Hold for two seconds without tipping, then switch.',
      feel: 'Stomach, back muscles and seat working together.',
      mistakes: ['Hips rotating open', 'Arching the back', 'Lifting the leg too high'],
      saferId: 'core_1', harderId: 'core_3', search: 'bird dog exercise physical therapy' },
    { id: 'core_3', pattern: 'core', level: 3, name: 'Knee plank', unit: 'seconds', low: 20, high: 40,
      cue: 'Forearms on the floor, elbows under your shoulders, knees down. Make one straight line from head to knees. Squeeze your seat, breathe slowly and hold.',
      feel: 'Your whole middle working.',
      mistakes: ['Hips piked up', 'Lower back sagging', 'Holding your breath'],
      saferId: 'core_2', harderId: 'core_4', search: 'knee plank modified plank form' },
    { id: 'core_4', pattern: 'core', level: 4, name: 'Plank', unit: 'seconds', low: 20, high: 45,
      cue: 'Forearms down, elbows under your shoulders, on your toes. One straight line from head to heels. Squeeze your seat and stomach, breathe, hold.',
      feel: 'Stomach, shoulders and seat.',
      mistakes: ['Hips sagging', 'Hips too high', 'Looking up and straining the neck'],
      saferId: 'core_3', harderId: 'core_5', search: 'forearm plank proper form' },
    { id: 'core_5', pattern: 'core', level: 5, name: 'Plank shoulder taps', unit: 'reps', low: 8, high: 16,
      cue: 'High plank on your hands (drop to your knees if needed), feet wider than hips. Slowly tap one shoulder with the opposite hand without letting your hips rock. Alternate sides. Count every tap.',
      feel: 'Stomach and sides working to keep you still.',
      mistakes: ['Hips swaying side to side', 'Rushing the taps', 'Feet too close together'],
      saferId: 'core_4', harderId: null, search: 'plank shoulder taps form' },
    // CARRY
    { id: 'carry_1', pattern: 'carry', level: 1, name: 'Suitcase carry', unit: 'seconds', low: 30, high: 45, perSide: true,
      cue: 'Hold a heavy grocery bag, jug or dumbbell in one hand like a suitcase. Stand tall without leaning toward or away from it. Walk slowly around the room or down the hall, then switch hands.',
      feel: 'The side of your waist, your grip and your shoulders.',
      mistakes: ['Leaning to one side', 'Shrugging the shoulder', 'Rushing'],
      saferId: null, harderId: 'carry_2', search: 'suitcase carry exercise' },
    { id: 'carry_2', pattern: 'carry', level: 2, name: 'Farmer\'s carry', unit: 'seconds', low: 30, high: 60,
      cue: 'Heavy bags or jugs in both hands. Stand tall, shoulders down and back, and walk with short, steady steps.',
      feel: 'Grip, shoulders, upper back and stomach.',
      mistakes: ['Rounded shoulders', 'Leaning back', 'Bags swinging'],
      saferId: 'carry_1', harderId: null, search: 'farmers carry form' },
    // CALVES
    { id: 'calf_1', pattern: 'calf', level: 1, name: 'Calf raise at the wall', unit: 'reps', low: 12, high: 20,
      cue: 'Stand tall holding a wall or counter lightly. Rise onto the balls of your feet as high as you can, pause, then lower slowly for two to three seconds.',
      feel: 'Your calves.',
      mistakes: ['Bouncing', 'Rolling out to the little toes', 'Half range'],
      saferId: null, harderId: 'calf_2', search: 'standing calf raise holding wall' },
    { id: 'calf_2', pattern: 'calf', level: 2, name: 'Single-leg calf raise', unit: 'reps', low: 8, high: 15, perSide: true,
      cue: 'Hold the wall lightly and stand on one foot. Rise as high as you can, pause, lower slowly. Finish one side, then switch.',
      feel: 'The calf on the standing leg.',
      mistakes: ['Bouncing', 'Leaning on the wall too much', 'Bending the knee'],
      saferId: 'calf_1', harderId: null, search: 'single leg calf raise form' }
  ];
  EXERCISES.forEach(function (e) {
    e.video = VIDEOS[e.id] || null;
    e.searchUrl = yt(e.search);
    e.status = 'active';
  });

  var WARMUP = {
    title: 'Warm-up', minutes: 3, video: VIDEOS.warmup,
    steps: [
      { name: 'March in place', seconds: 45, cue: 'March in place and swing your arms. Start easy and get a little faster.' },
      { name: 'Arm circles', seconds: 30, cue: 'Arms out to the sides. Small circles forward, then backward.' },
      { name: 'Hip circles', seconds: 30, cue: 'Hands on your hips. Make slow circles one way, then the other.' },
      { name: 'Easy squats', seconds: 30, cue: 'Eight easy squats to a chair. Slow and comfortable.' },
      { name: 'Good mornings', seconds: 30, cue: 'Hands on your hips. Push your hips back and tip forward with a flat back, then stand tall. Eight times.' },
      { name: 'Wall push-ups', seconds: 15, cue: 'Eight easy wall push-ups. You are ready.' }
    ]
  };
  var COOLDOWN = {
    title: 'Cool-down', minutes: 2, video: VIDEOS.cooldown,
    steps: [
      { name: 'Slow breathing', seconds: 30, cue: 'Walk slowly or stand still. Breathe in through your nose for four, out for six.' },
      { name: 'Calf stretch', seconds: 40, cue: 'Hands on the wall, one foot back with the heel down. Hold twenty seconds each side.' },
      { name: 'Thigh stretch', seconds: 40, cue: 'Hold the wall, bend one knee and hold your ankle behind you. Twenty seconds each side.' },
      { name: 'Hamstring stretch', seconds: 40, cue: 'Heel on a low step, leg straight. Hinge forward with a flat back until you feel a stretch. Twenty seconds each side.' },
      { name: 'Doorway chest stretch', seconds: 30, cue: 'Forearms on the door frame, step through gently until you feel a stretch across your chest. Breathe.' }
    ]
  };
  var WALKING = { video: VIDEOS.walking, cue: 'Walk tall, eyes ahead, arms swinging naturally. Brisk means you can talk but not sing.' };

  // ------------------------------------------------------------------ habits
  var HABITS = [
    { key: 'protein_first', label: 'Protein first', short: 'Protein', why: 'Start every meal with the protein on your plate. It fills you up and protects muscle.' },
    { key: 'water_only', label: 'Water or seltzer only', short: 'Water', why: 'No juice or sugary drinks today.' },
    { key: 'veg_dinner', label: 'Veggies at dinner', short: 'Veggies', why: 'Half the dinner plate vegetables.' },
    { key: 'three_meals', label: 'Three real meals', short: '3 meals', why: 'Real meals instead of grazing.' },
    { key: 'breakfast', label: 'Breakfast', short: 'Breakfast', why: 'Something with protein within a few hours of waking.' },
    { key: 'kitchen_closed', label: 'Kitchen closed on time', short: 'Kitchen closed', why: 'Done eating 2–3 hours before bed.' },
    { key: 'planned_nosh', label: 'Planned nosh only', short: 'Planned nosh', why: 'Snacks from your nosh list, already portioned.' }
  ];

  var FOOD_RULES = [
    'Protein first at every meal.',
    'Water or seltzer only.',
    'Three real meals a day.',
    'Half the dinner plate vegetables.',
    'Start meals with salad, soup or a glass of water.',
    'Kitchen closed 2–3 hours before bed.',
    'Planned, portioned nosh — from the list, onto a plate, never from the bag.'
  ];
  var SLEEP_RULES = [
    '7–9 hours a night.',
    'Same bedtime every night, even on weekends.',
    'Screens off before bed.',
    'No coffee after noon.',
    'Get morning daylight — even five minutes outside.'
  ];

  var NOSH = [
    { item: 'Almonds or pistachios', portion: '1 small handful (1 oz)', kind: 'pareve' },
    { item: 'Greek yogurt cup', portion: '1 cup (5–6 oz)', kind: 'dairy' },
    { item: 'String cheese and an apple', portion: '1 stick + 1 apple', kind: 'dairy' },
    { item: 'Hard-boiled eggs', portion: '2 eggs', kind: 'pareve' },
    { item: 'Veggie sticks and hummus', portion: 'Unlimited veggies + 1/4 cup hummus', kind: 'pareve' },
    { item: 'Air-popped popcorn', portion: '3 cups', kind: 'pareve' },
    { item: 'Beef jerky or turkey sticks', portion: '1 oz (with a reliable hechsher)', kind: 'meat' },
    { item: 'Rice cakes with peanut butter', portion: '2 rice cakes + 1 Tbsp', kind: 'pareve' },
    { item: 'Edamame', portion: '1 cup in the pod', kind: 'pareve' },
    { item: 'Pickles', portion: 'As many as you like', kind: 'pareve' },
    { item: 'Cottage cheese with fruit', portion: '1/2 cup + 1/2 cup fruit', kind: 'dairy' },
    { item: 'Dark chocolate', portion: '2 squares', kind: 'pareve' },
    { item: 'Roasted chickpeas', portion: '1/3 cup', kind: 'pareve' },
    { item: 'Frozen grapes and seltzer', portion: '1 cup grapes', kind: 'pareve' }
  ];

  // ------------------------------------------------------------------ recipes
  // Original recipes. ing: [quantity, item, store section]. kind: meat | dairy | pareve | fish (pareve)
  var SECTIONS = ['Produce', 'Meat & poultry', 'Fish', 'Dairy & eggs', 'Bakery', 'Pantry', 'Spices & sauces', 'Frozen', 'Nosh'];
  var RECIPES = [
    { id: 'r_zaatar_chicken', title: 'Za\'atar lemon sheet-pan chicken', kind: 'meat', meal: 'dinner', minutes: 45, serves: 4,
      ing: [['2½ lb', 'bone-in chicken thighs', 'Meat & poultry'], ['2', 'red onions', 'Produce'], ['1 head', 'cauliflower (or 1 lb baby potatoes)', 'Produce'], ['2', 'lemons', 'Produce'], ['1 head', 'garlic', 'Produce'], ['1 bunch', 'parsley', 'Produce'], ['3 Tbsp', 'olive oil', 'Pantry'], ['2 Tbsp', 'za\'atar', 'Spices & sauces']],
      steps: ['Heat the oven to 425°F.', 'Cut onions into wedges and cauliflower into florets. Toss with 1 Tbsp oil and salt on a sheet pan.', 'Rub the chicken with the rest of the oil, za\'atar, salt, pepper and the zest of one lemon.', 'Set the chicken skin-up on the vegetables with smashed garlic and lemon wedges.', 'Roast 35–40 minutes, until the thickest piece reads 175°F and the skin is crisp.', 'Squeeze the roasted lemon over everything and scatter parsley. Serve with a big salad.'] },
    { id: 'r_harissa_skewers', title: 'Harissa-honey chicken skewers', kind: 'meat', meal: 'dinner', minutes: 30, serves: 4,
      ing: [['2 lb', 'boneless chicken thighs or breasts', 'Meat & poultry'], ['2', 'bell peppers', 'Produce'], ['1', 'red onion', 'Produce'], ['1', 'lemon', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['3 Tbsp', 'harissa paste', 'Spices & sauces'], ['1 Tbsp', 'honey', 'Pantry'], ['2 Tbsp', 'olive oil', 'Pantry'], ['1 tsp', 'cumin', 'Spices & sauces'], ['1 pack', 'skewers', 'Pantry']],
      steps: ['Mix harissa, honey, oil, lemon juice, grated garlic, cumin and salt.', 'Cut the chicken into cubes and marinate 30 minutes or overnight.', 'Thread onto skewers with chunks of pepper and onion.', 'Grill or broil on high 10–12 minutes, turning, until cooked through (165°F).', 'Serve with Israeli salad and a drizzle of tahini.'] },
    { id: 'r_beef_broccoli', title: 'Spicy beef and broccoli stir-fry', kind: 'meat', meal: 'dinner', minutes: 25, serves: 4,
      ing: [['1½ lb', 'flank steak or London broil', 'Meat & poultry'], ['2 heads', 'broccoli', 'Produce'], ['1', 'red pepper', 'Produce'], ['1 piece', 'fresh ginger', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1 bunch', 'scallions', 'Produce'], ['3 Tbsp', 'soy sauce', 'Spices & sauces'], ['1 Tbsp', 'gochujang or sriracha', 'Spices & sauces'], ['1 Tbsp', 'rice vinegar', 'Spices & sauces'], ['1 Tbsp', 'cornstarch', 'Pantry'], ['1 Tbsp', 'honey', 'Pantry'], ['2 Tbsp', 'avocado oil', 'Pantry'], ['1 Tbsp', 'sesame seeds', 'Pantry']],
      steps: ['Slice the beef thin against the grain.', 'Whisk soy sauce, gochujang, honey, vinegar and cornstarch with 1/4 cup water.', 'Sear the beef in very hot oil in two batches, 1–2 minutes each. Set aside.', 'Stir-fry broccoli and pepper 4 minutes with a splash of water.', 'Add grated ginger and garlic for 30 seconds, return the beef, pour in the sauce and toss until glossy.', 'Top with scallions and sesame. Serve over cauliflower rice or a small scoop of rice.'] },
    { id: 'r_london_broil', title: 'Coffee-chili London broil with chimichurri', kind: 'meat', meal: 'dinner', minutes: 30, serves: 6,
      ing: [['2 lb', 'London broil', 'Meat & poultry'], ['1 bunch', 'parsley', 'Produce'], ['1 bunch', 'cilantro', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1 Tbsp', 'finely ground coffee', 'Pantry'], ['1 Tbsp', 'smoked paprika', 'Spices & sauces'], ['1 tsp', 'chili powder', 'Spices & sauces'], ['1 tsp', 'brown sugar', 'Pantry'], ['1/4 cup', 'red wine vinegar', 'Spices & sauces'], ['1/3 cup', 'olive oil', 'Pantry'], ['1/2 tsp', 'red pepper flakes', 'Spices & sauces']],
      steps: ['Mix coffee, paprika, chili powder, sugar, garlic powder, salt and pepper. Rub all over the meat and rest 30 minutes (or overnight in the fridge).', 'Broil or grill on high 6–8 minutes per side for medium-rare (130–135°F).', 'Rest 10 minutes.', 'Chop parsley, cilantro and garlic; stir in vinegar, oil, pepper flakes and salt.', 'Slice thin against the grain and spoon the chimichurri over. Serve with roasted vegetables.'] },
    { id: 'r_turkey_meatballs', title: 'Moroccan turkey meatballs in tomato sauce', kind: 'meat', meal: 'dinner', minutes: 40, serves: 6,
      ing: [['2 lb', 'ground turkey (or beef)', 'Meat & poultry'], ['1', 'egg', 'Dairy & eggs'], ['1', 'onion', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1 bunch', 'cilantro or parsley', 'Produce'], ['1/3 cup', 'breadcrumbs or oat flour', 'Pantry'], ['28 oz can', 'crushed tomatoes', 'Pantry'], ['2 tsp', 'cumin', 'Spices & sauces'], ['2 tsp', 'sweet paprika', 'Spices & sauces'], ['1/2 tsp', 'harissa or hot paprika', 'Spices & sauces']],
      steps: ['Mix the meat, egg, grated onion, garlic, crumbs, 1 tsp cumin, 1 tsp paprika, a pinch of cinnamon, herbs and salt. Roll about 24 balls.', 'In a wide pan, simmer tomatoes with oil, the rest of the cumin and paprika, harissa and salt for 5 minutes.', 'Nestle in the meatballs, cover and simmer 20–25 minutes.', 'Finish with herbs. Serve with roasted zucchini. Freezes well.'] },
    { id: 'r_turkey_chili', title: 'Smoky turkey and bean chili', kind: 'meat', meal: 'dinner', minutes: 45, serves: 8,
      ing: [['2 lb', 'ground turkey or lean beef', 'Meat & poultry'], ['1', 'onion', 'Produce'], ['1', 'red pepper', 'Produce'], ['4 cloves', 'garlic', 'Produce'], ['1', 'avocado', 'Produce'], ['28 oz can', 'crushed tomatoes', 'Pantry'], ['2 cans', 'black or kidney beans', 'Pantry'], ['1 cup', 'chicken broth', 'Pantry'], ['2 Tbsp', 'chili powder', 'Spices & sauces'], ['1 Tbsp', 'cumin', 'Spices & sauces'], ['1 tsp', 'smoked paprika', 'Spices & sauces'], ['1', 'chipotle in adobo (optional)', 'Spices & sauces']],
      steps: ['Brown the meat in a big pot.', 'Add onion and pepper and cook 5 minutes; add garlic and spices for 1 minute.', 'Add tomatoes, rinsed beans, broth and chipotle. Simmer 25 minutes.', 'Top with avocado, scallions and cilantro. Lunch for days.'] },
    { id: 'r_roast_chicken', title: 'Herb roast chicken with root vegetables', kind: 'meat', meal: 'shabbat', minutes: 90, serves: 6,
      ing: [['1 (4–5 lb)', 'whole chicken or 4 lb pieces', 'Meat & poultry'], ['1', 'lemon', 'Produce'], ['1 head', 'garlic', 'Produce'], ['3', 'carrots', 'Produce'], ['2', 'parsnips', 'Produce'], ['1', 'large onion', 'Produce'], ['1', 'sweet potato', 'Produce'], ['1 pack', 'fresh rosemary and thyme', 'Produce'], ['3 Tbsp', 'olive oil', 'Pantry'], ['1 tsp', 'paprika', 'Spices & sauces']],
      steps: ['Heat the oven to 425°F.', 'Cut vegetables into chunks, toss with 1 Tbsp oil and salt in a roasting pan.', 'Rub the chicken with oil, chopped herbs, paprika, salt and pepper. Put lemon halves and half the garlic inside.', 'Set the chicken on the vegetables and roast 1 hr 15 min–1 hr 30 min, until the thigh reads 175°F.', 'Rest 15 minutes. Made Friday morning, it rewarms well for the seudah.'] },
    { id: 'r_lighter_cholent', title: 'Lighter cholent', kind: 'meat', meal: 'shabbat', minutes: 30, serves: 8,
      ing: [['1½ lb', 'lean beef (trimmed shoulder or brisket)', 'Meat & poultry'], ['1 cup', 'barley', 'Pantry'], ['1 cup', 'dry mixed beans', 'Pantry'], ['2', 'onions', 'Produce'], ['2', 'potatoes', 'Produce'], ['2', 'sweet potatoes', 'Produce'], ['4', 'carrots', 'Produce'], ['1 head', 'garlic', 'Produce'], ['2 Tbsp', 'paprika', 'Spices & sauces'], ['1 Tbsp', 'honey (optional)', 'Pantry']],
      steps: ['Soak the beans overnight.', 'Layer onions, beans, barley, potatoes, carrots, garlic and meat in the pot.', 'Season with paprika, honey, pepper and 2 tsp salt; cover with water by an inch.', 'Bring to a boil before Shabbat, then set it on the blech or the slow cooker on low overnight.', 'Serve a meat-heavy bowl with extra vegetables and a smaller scoop of barley and potato. Salad first.'] },
    { id: 'r_shawarma_bowl', title: 'Chicken shawarma bowls', kind: 'meat', meal: 'dinner', minutes: 35, serves: 4,
      ing: [['2 lb', 'boneless chicken thighs', 'Meat & poultry'], ['4', 'Persian cucumbers', 'Produce'], ['3', 'tomatoes', 'Produce'], ['1', 'red onion', 'Produce'], ['1 bunch', 'parsley', 'Produce'], ['1 head', 'romaine (checked)', 'Produce'], ['1', 'lemon', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1 jar', 'pickles', 'Pantry'], ['1 jar', 'tahini', 'Pantry'], ['2 tsp', 'cumin', 'Spices & sauces'], ['2 tsp', 'paprika', 'Spices & sauces'], ['1 tsp', 'turmeric', 'Spices & sauces']],
      steps: ['Toss the chicken with cumin, paprika, turmeric, a pinch of cinnamon and allspice, garlic, lemon juice, oil and salt. Rest 20 minutes.', 'Roast at 450°F for 20–25 minutes (or grill), then slice.', 'Chop cucumbers, tomatoes, onion and parsley into a salad.', 'Build bowls: lettuce, chicken, salad, pickles and a drizzle of tahini thinned with water and lemon.'] },
    { id: 'r_peri_peri', title: 'Peri-peri spatchcock chicken', kind: 'meat', meal: 'dinner', minutes: 60, serves: 4,
      ing: [['1 (4 lb)', 'chicken, spatchcocked by the butcher', 'Meat & poultry'], ['2–4', 'red chilies (or 1 tsp cayenne)', 'Produce'], ['2', 'lemons', 'Produce'], ['4 cloves', 'garlic', 'Produce'], ['1 jar', 'roasted red peppers', 'Pantry'], ['2 Tbsp', 'red wine vinegar', 'Spices & sauces'], ['1 Tbsp', 'smoked paprika', 'Spices & sauces'], ['1 tsp', 'oregano', 'Spices & sauces'], ['3 Tbsp', 'olive oil', 'Pantry']],
      steps: ['Blend chilies, one roasted pepper, garlic, lemon juice, vinegar, paprika, oregano, oil and salt.', 'Rub half the sauce over and under the skin. Marinate 1 hour or overnight.', 'Roast skin-up at 425°F for 45–50 minutes (or grill), basting with more sauce, until the thigh reads 175°F.', 'Serve with a big green salad.'] },
    { id: 'r_chicken_soup', title: 'Vegetable-packed chicken soup', kind: 'meat', meal: 'shabbat', minutes: 120, serves: 10,
      ing: [['3 lb', 'chicken pieces', 'Meat & poultry'], ['2', 'onions', 'Produce'], ['6', 'carrots', 'Produce'], ['4 stalks', 'celery', 'Produce'], ['2', 'parsnips', 'Produce'], ['2', 'zucchini', 'Produce'], ['1 bunch', 'dill', 'Produce'], ['1 bunch', 'parsley', 'Produce']],
      steps: ['Cover the chicken with about 12 cups of water, bring to a simmer and skim.', 'Add the vegetables and herbs; simmer gently 1½–2 hours.', 'Season with salt and pepper. Pull the chicken meat into the bowls.', 'Serve it first: a warm, filling start makes the rest of the meal easier.'] },
    { id: 'r_salmon', title: 'Honey-mustard salmon with green beans', kind: 'fish', meal: 'dinner', minutes: 25, serves: 4,
      ing: [['4 (6 oz)', 'salmon fillets', 'Fish'], ['1 lb', 'green beans', 'Produce'], ['1', 'lemon', 'Produce'], ['2 cloves', 'garlic', 'Produce'], ['2 Tbsp', 'Dijon mustard', 'Spices & sauces'], ['1 Tbsp', 'honey', 'Pantry'], ['1 Tbsp', 'soy sauce', 'Spices & sauces'], ['1 Tbsp', 'olive oil', 'Pantry']],
      steps: ['Heat the oven to 425°F. Toss green beans with oil and salt on a sheet pan.', 'Mix mustard, honey, soy sauce and grated garlic; brush over the salmon and set it on the pan.', 'Roast 12–15 minutes, until the salmon flakes.', 'Lemon over everything. (Fish is served as its own meal or course, apart from meat.)'] },
    { id: 'r_tuna_wraps', title: 'Tuna crunch lettuce wraps', kind: 'fish', meal: 'lunch', minutes: 10, serves: 2,
      ing: [['2 cans', 'tuna in water', 'Fish'], ['1 stalk', 'celery', 'Produce'], ['1 head', 'butter lettuce (checked)', 'Produce'], ['1', 'lemon', 'Produce'], ['2 Tbsp', 'light mayonnaise', 'Pantry'], ['1 Tbsp', 'Dijon mustard', 'Spices & sauces'], ['1 jar', 'pickles', 'Pantry']],
      steps: ['Mix tuna, mayo, mustard, diced celery, red onion, a diced pickle, lemon and pepper.', 'Spoon into lettuce leaves.', 'Add cucumbers and tomatoes on the side.'] },
    { id: 'r_shakshuka', title: 'Shakshuka with feta', kind: 'dairy', meal: 'dinner', minutes: 25, serves: 3,
      ing: [['6', 'eggs', 'Dairy & eggs'], ['1/3 cup', 'feta cheese', 'Dairy & eggs'], ['1', 'onion', 'Produce'], ['1', 'red pepper', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1 bunch', 'parsley', 'Produce'], ['28 oz can', 'crushed tomatoes', 'Pantry'], ['1 tsp', 'cumin', 'Spices & sauces'], ['1 tsp', 'paprika', 'Spices & sauces']],
      steps: ['Soften the onion and pepper in oil for 6 minutes; add garlic, cumin, paprika and chili flakes for a minute.', 'Add the tomatoes and simmer 8 minutes.', 'Make six wells, crack in the eggs, cover and cook 6–8 minutes.', 'Top with feta and herbs. (Skip the feta for a pareve version.)'] },
    { id: 'r_yogurt_bowl', title: 'Greek yogurt protein bowl', kind: 'dairy', meal: 'breakfast', minutes: 3, serves: 1,
      ing: [['1 cup', 'plain Greek yogurt', 'Dairy & eggs'], ['1/2 cup', 'berries', 'Produce'], ['1 Tbsp', 'chia or ground flax', 'Pantry'], ['1 Tbsp', 'chopped nuts', 'Pantry']],
      steps: ['Spoon the yogurt into a bowl.', 'Top with berries, seeds, nuts and cinnamon. A little honey is fine.'] },
    { id: 'r_egg_muffins', title: 'Make-ahead veggie egg muffins', kind: 'pareve', meal: 'breakfast', minutes: 30, serves: 6,
      ing: [['10', 'eggs', 'Dairy & eggs'], ['1 bag', 'baby spinach', 'Produce'], ['1', 'red pepper', 'Produce'], ['1', 'onion', 'Produce']],
      steps: ['Heat the oven to 350°F and grease a 12-cup muffin tin.', 'Divide chopped spinach, pepper and onion into the cups (add shredded cheese for a dairy version).', 'Whisk the eggs with salt and pepper and pour over.', 'Bake 20–22 minutes until set. Keeps 4 days in the fridge; 2–3 make a breakfast.'] },
    { id: 'r_overnight_oats', title: 'Protein overnight oats', kind: 'dairy', meal: 'breakfast', minutes: 5, serves: 1,
      ing: [['1/2 cup', 'rolled oats', 'Pantry'], ['1/2 cup', 'milk', 'Dairy & eggs'], ['1/2 cup', 'plain Greek yogurt', 'Dairy & eggs'], ['1 Tbsp', 'chia seeds', 'Pantry'], ['1/2 cup', 'berries', 'Produce']],
      steps: ['Stir oats, milk, yogurt, chia and cinnamon in a jar.', 'Refrigerate overnight and top with fruit.', 'Make three jars on Sunday night.'] },
    { id: 'r_lentil_soup', title: 'Red lentil soup', kind: 'pareve', meal: 'lunch', minutes: 35, serves: 6,
      ing: [['1½ cups', 'red lentils', 'Pantry'], ['1', 'onion', 'Produce'], ['2', 'carrots', 'Produce'], ['2 stalks', 'celery', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1', 'lemon', 'Produce'], ['1 can', 'diced tomatoes', 'Pantry'], ['1 tsp', 'cumin', 'Spices & sauces'], ['1 tsp', 'turmeric', 'Spices & sauces']],
      steps: ['Soften onion, carrot and celery in oil for 6 minutes; add garlic and spices.', 'Add rinsed lentils, tomatoes and 6 cups of water or pareve broth. Simmer 20 minutes.', 'Blend part of it, then finish with lemon and salt. Freezes well; add two eggs on the side for more protein.'] },
    { id: 'r_cottage_omelet', title: 'Cottage cheese veggie omelet', kind: 'dairy', meal: 'breakfast', minutes: 10, serves: 1,
      ing: [['3', 'eggs', 'Dairy & eggs'], ['1/3 cup', 'cottage cheese', 'Dairy & eggs'], ['1 handful', 'baby spinach', 'Produce'], ['4', 'mushrooms', 'Produce']],
      steps: ['Whisk the eggs with salt and pepper.', 'Cook the vegetables 2 minutes in a sprayed pan, pour in the eggs and cook until nearly set.', 'Add the cottage cheese and fold.'] },
    { id: 'r_israeli_salad', title: 'Israeli chopped salad', kind: 'pareve', meal: 'side', minutes: 10, serves: 4,
      ing: [['4', 'Persian cucumbers', 'Produce'], ['4', 'tomatoes', 'Produce'], ['1', 'red pepper', 'Produce'], ['1', 'red onion', 'Produce'], ['1 bunch', 'parsley', 'Produce'], ['1', 'lemon', 'Produce'], ['2 Tbsp', 'olive oil', 'Pantry']],
      steps: ['Dice everything small.', 'Dress with lemon, oil and salt just before serving.'] },
    { id: 'r_roast_broccoli', title: 'Garlic-chili roasted broccoli', kind: 'pareve', meal: 'side', minutes: 25, serves: 4,
      ing: [['2 heads', 'broccoli', 'Produce'], ['3 cloves', 'garlic', 'Produce'], ['1', 'lemon', 'Produce'], ['2 Tbsp', 'olive oil', 'Pantry'], ['1/2 tsp', 'red pepper flakes', 'Spices & sauces']],
      steps: ['Heat the oven to 425°F.', 'Toss florets with oil, sliced garlic, pepper flakes and salt.', 'Roast 18–20 minutes until the edges char. Finish with lemon.'] },
    { id: 'r_lime_slaw', title: 'Crunchy cabbage-lime slaw', kind: 'pareve', meal: 'side', minutes: 10, serves: 6,
      ing: [['1 bag', 'shredded cabbage (certified checked)', 'Produce'], ['2', 'carrots', 'Produce'], ['1 bunch', 'scallions', 'Produce'], ['1 bunch', 'cilantro', 'Produce'], ['2', 'limes', 'Produce'], ['1 Tbsp', 'olive oil', 'Pantry'], ['1 tsp', 'honey', 'Pantry']],
      steps: ['Toss cabbage, grated carrots, scallions and cilantro.', 'Dress with lime juice, oil, honey and salt. Great next to anything grilled.'] },
    { id: 'r_steak_salad', title: 'Leftover steak or chicken salad bowl', kind: 'meat', meal: 'lunch', minutes: 10, serves: 1,
      ing: [['6 oz', 'leftover steak or chicken', 'Meat & poultry'], ['2 cups', 'mixed greens (checked)', 'Produce'], ['1', 'Persian cucumber', 'Produce'], ['1/2', 'avocado', 'Produce']],
      steps: ['Pile greens and chopped vegetables in a container.', 'Top with sliced leftover protein.', 'Dress with lemon, olive oil and salt — or leftover chimichurri.'] }
  ];
  // Round 3.2 (H3): a short name for Plan's one-line meal rows (the recipe sheet keeps the full title)
  var RECIPE_SHORT = {
    r_zaatar_chicken: 'Za\'atar sheet-pan chicken', r_harissa_skewers: 'Harissa chicken skewers', r_beef_broccoli: 'Beef and broccoli stir-fry',
    r_london_broil: 'Coffee-chili London broil', r_turkey_meatballs: 'Moroccan turkey meatballs', r_roast_chicken: 'Herb roast chicken',
    r_peri_peri: 'Peri-peri chicken', r_chicken_soup: 'Chicken soup', r_salmon: 'Honey-mustard salmon', r_egg_muffins: 'Veggie egg muffins',
    r_cottage_omelet: 'Cottage cheese omelet', r_roast_broccoli: 'Garlic-chili broccoli', r_steak_salad: 'Steak or chicken salad'
  };
  RECIPES.forEach(function (r) { if (RECIPE_SHORT[r.id]) r.short = RECIPE_SHORT[r.id]; });
  var GROCERY_NOTE = 'Leafy vegetables, herbs and cabbage: buy certified-checked or check them according to your practice. Look for a reliable hechsher on packaged items.';

  // ------------------------------------------------------------------ if-then plans
  var IF_THEN = [
    { id: 'it_shabbat', situation: 'Shabbat meals', rules: [
      ['It\'s Friday night or Shabbat lunch', 'Start with soup, fish or salad, then the chicken or meat first.'],
      ['The challah comes around', 'Have the slice I really enjoy, then pass the basket.'],
      ['There are ten side dishes', 'Take the two I love most. Skip the ones I don\'t.'],
      ['Dessert is served', 'One dessert I really want, on a small plate, sitting down.'],
      ['The meal is over', 'No counting, no guilt. Back to normal on Sunday.']] },
    { id: 'it_kiddush', situation: 'Kiddush', rules: [
      ['I walk into kiddush', 'Fill one plate: protein and salad first.'],
      ['I\'ve finished my plate', 'Step away from the table and talk to people.'],
      ['Lunch is coming soon', 'Keep kiddush small so I enjoy the real meal.']] },
    { id: 'it_simcha', situation: 'Simchas and weddings', rules: [
      ['I\'m leaving for a wedding', 'Eat a protein snack before I go.'],
      ['I\'m at the smorgasbord', 'One plate: protein and salad, then I go say mazel tov.'],
      ['The music starts', 'Dance — it counts.'],
      ['The dessert table opens', 'Pick one thing or skip it. Seltzer in hand.']] },
    { id: 'it_yomtov', situation: 'Yom Tov', rules: [
      ['It\'s a multi-day Yom Tov', 'Protein first at every meal and water between meals.'],
      ['Lunch ends', 'A family walk after the meal if the weather allows.'],
      ['Yom Tov ends', 'Right back to routine the next morning — no "starting Monday".']] },
    { id: 'it_restaurant', situation: 'Restaurants and takeout', rules: [
      ['I order', 'Grilled protein plus a vegetable side, sauce on the side.'],
      ['Fries or bread arrive', 'Share them or box half before I start.'],
      ['They ask about drinks', 'Seltzer or water.']] },
    { id: 'it_road', situation: 'Road days (sales calls)', rules: [
      ['I\'m driving all day', 'Pack water and two protein snacks before I leave.'],
      ['I\'m between appointments', 'Walk 5–10 minutes before getting back in the car.'],
      ['I\'m starving at 4 pm', 'Eat the planned snack instead of the gas-station nosh.']] },
    { id: 'it_night', situation: 'Late-night cravings', rules: [
      ['I want food after the kitchen closed', 'Water or tea first, then brush my teeth.'],
      ['It\'s still loud', 'Press Craving SOS and text my partner.']] },
    { id: 'it_hardday', situation: 'Hard days', rules: [
      ['I had a terrible day', 'Five-minute walk or call my partner before I open the fridge.'],
      ['I missed a workout', 'Do the 10-minute version. Never miss twice.']] }
  ];

  // ------------------------------------------------------------------ guides
  var GUIDES = [
    { id: 'g_food', title: 'Food rules', icon: 'plate', body: FOOD_RULES },
    { id: 'g_sleep', title: 'Sleep rules', icon: 'moon', body: SLEEP_RULES },
    { id: 'g_prep', title: 'Prep checklist', icon: 'check', body: [
      'Scale: a digital scale in the same spot, used at the same time each morning.',
      'Workout corner: a sturdy chair, a towel or mat, and something heavy (backpack, jugs, or dumbbells).',
      'Walking shoes by the door; the stroller ready.',
      'Grocery run from this week\'s list, including the nosh list.',
      'Nosh portioned into small bags or containers.',
      'Bedtime: set a phone alarm 30 minutes before bed to start winding down.'] },
    { id: 'g_road', title: 'Road rules', icon: 'car', body: [
      'Water bottle and seltzer in the car.',
      'Two protein snacks packed before leaving.',
      'Plan the kosher stop in advance — don\'t decide hungry.',
      'Walk 5–10 minutes between appointments.',
      'Caffeine before noon only.'] },
    { id: 'g_shabbat', title: 'Shabbat and Yom Tov', icon: 'candle', body: [
      'Shabbat and Yom Tov are full rest days. No workout, no counting, no logging.',
      'Eat the meals and enjoy them. Protein first, then don\'t think about it.',
      'Plan the week around Shabbat: normal meals on Thursday and Friday — don\'t "save up" by skipping.',
      'A relaxed family walk on Shabbat afternoon is a bonus, never a job.',
      'Motzei Shabbat: log Friday and Shabbat in two taps, then you\'re set for the week.'] },
    { id: 'g_fast', title: 'Fast days', icon: 'drop', body: [
      'The day before: drink extra water through the day and eat normal meals with protein.',
      'On the fast: workouts are paused automatically. Rest, keep it calm, skip the scale.',
      'Breaking the fast: water first, then a light meal with protein. Go slow — no need to make up for it.',
      'The next day is a normal day. The scale may be off for a day or two; the trend line handles that.'] },
    { id: 'g_warm', title: 'Warm-up and cool-down', icon: 'play', body: WARMUP.steps.map(function (s) { return s.name + ': ' + s.cue; }).concat(COOLDOWN.steps.map(function (s) { return s.name + ': ' + s.cue; })) },
    { id: 'g_weigh', title: 'Weighing in', icon: 'scale', body: [
      'Same scale, same spot, same time: after waking and using the bathroom, before eating.',
      'Daily numbers jump around with water and salt. The trend line is what matters.',
      'Prefer weekly? Switch to a weekly weigh-in in Settings.',
      'The belt notch tells the truth: check your waist once a week too.'] },
    { id: 'g_photos', title: 'Progress photos', icon: 'camera', body: [
      'Once a month: same clothes, same light, same spot, same pose.',
      'Front and side. Your photos are saved only in the owner\'s Google Drive.',
      'Compare side by side in Progress — changes you can\'t see day to day show up month to month.'] },
    { id: 'g_creatine', title: 'Creatine note', icon: 'pill', body: [
      'If you start creatine, expect the scale to go up 2–4 lbs in the first weeks. That is water in your muscles, not fat.',
      'The trend line will settle. Your waist measurement tells the real story.',
      'Ask your doctor before starting, especially with kidney problems, during pregnancy or nursing, or with medications.'] },
    { id: 'g_travel', title: 'Travel mode', icon: 'car', body: [
      'Turn on Travel in Modes. Workouts become 10-minute hotel-room versions (no equipment).',
      'Walk the airport, the city, the hotel stairs — it all counts.',
      'Pack protein snacks and look up kosher options before you go.',
      'Weigh-ins pause their pressure — expect a bump from travel; it settles in a few days.'] },
    { id: 'g_sick', title: 'Sick mode', icon: 'heart', body: [
      'Turn on Sick in Modes. Workouts pause and your streak is safe.',
      'Fluids, sleep and simple food. Come back with the 10-minute version when you feel better.',
      'Fever, chest pain, trouble breathing, or anything that worries you: call your doctor.'] }
  ];

  // ------------------------------------------------------------------ modes
  var MODES = [
    { key: 'sick', label: 'Sick', days: 3, desc: 'Workouts pause. Rest, fluids, sleep. Your streak is safe.' },
    { key: 'travel', label: 'Travel', days: 7, desc: '10-minute hotel-room workouts, walking counts, road rules on.' },
    { key: 'busy', label: 'Busy week', days: 7, desc: '10-minute versions and the minimum habits. Something beats nothing.' },
    { key: 'maintenance', label: 'Maintenance', days: 0, desc: 'Goal reached: keep-it-off habits, weekly weigh-ins, daily breakfast, regular weighing.' },
    { key: 'welcomeback', label: 'Welcome back', days: 7, desc: 'No guilt. Restart one level down this week and build back up.' }
  ];

  // ------------------------------------------------------------------ together
  var CHEERS = ['Proud of you.', 'You\'ve got this.', 'Way to show up today.', 'Saw your workout — amazing.', 'One step at a time. I\'m with you.', 'Walk together tonight?'];
  var NUDGE = 'Did you log today?';
  var COUPLE_QUESTIONS = [
    { key: 'well', q: 'What went well this week?' },
    { key: 'hard', q: 'What was hard?' },
    { key: 'for_partner', q: 'One thing you\'ll do for each other this week?' }
  ];
  var REWARD_IDEAS = ['Date night out', 'New walking shoes', 'A babysitter for a quiet evening', 'A cookbook or a good knife', 'A day trip with the kids'];

  // ------------------------------------------------------------------ SOS
  var SOS_STEPS = [
    { seconds: 20, title: 'Drink a full glass of water', say: 'First, drink a full glass of water. Slowly.' },
    { seconds: 20, title: 'Pick a protein snack — or wait it out', say: 'If you\'re actually hungry, pick a protein snack from your nosh list. If not, we wait it out.' },
    { seconds: 40, title: 'Move for a few minutes', say: 'Now walk. Around the house is fine. Five minutes if you can.' },
    { seconds: 20, title: 'Delay ten minutes', say: 'Set a ten-minute delay. If you still want it after, have a planned portion on a plate, sitting down.' },
    { seconds: 20, title: 'Text your partner', say: 'Last step: tell your partner. You don\'t have to do this alone.' }
  ];

  // ------------------------------------------------------------------ setup
  var PARQ = [
    'Has a doctor ever said you have a heart condition or high blood pressure?',
    'Do you get chest pain at rest, during daily activities, or when you exercise?',
    'In the past 12 months, have you lost your balance because of dizziness, or passed out?',
    'Have you been diagnosed with another chronic medical condition (besides heart disease or high blood pressure)?',
    'Do you take prescribed medication for a chronic medical condition?',
    'Do you have (or have you had in the past year) a bone, joint or muscle problem that could get worse with more activity?',
    'Has a doctor ever said you should only do medically supervised physical activity?'
  ];
  var CHOICES = {
    nonScale: ['Keep up with the kids', 'Clothes fit better', 'More energy', 'Better blood pressure or sugar', 'Get stronger', 'Sleep better', 'Feel confident'],
    activity: [['sitting', 'Mostly sitting'], ['some', 'Some walking'], ['few', 'Active a few days a week'], ['very', 'Very active']],
    days: [['0', 'Sun'], ['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri']],
    times: ['Early morning', 'Lunch break', 'After work', 'After the kids are asleep'],
    minutes: [['10', '10 min'], ['20', '20 min'], ['30', '30 min']],
    equipment: ['Chair', 'Wall', 'Floor', 'Dumbbells', 'Resistance bands', 'Backpack or jugs', 'Stroller'],
    injuries: ['Knees', 'Lower back', 'Shoulders', 'Wrists', 'Hips', 'Ankles or feet', 'Neck'],
    lifeStage: [['none', 'None of these'], ['pregnant', 'Pregnant'], ['nursing', 'Nursing'], ['postpartum', 'Recently had a baby']],
    foods: ['Chicken', 'Beef', 'Turkey', 'Fish', 'Eggs', 'Greek yogurt', 'Cottage cheese', 'Beans and lentils', 'Tofu', 'Salads', 'Roasted vegetables', 'Soups', 'Spicy food', 'Rice', 'Potatoes', 'Pasta', 'Fruit'],
    cooking: [['love', 'I love to cook'], ['basics', 'I can cook the basics'], ['rather_not', 'I\'d rather not cook']],
    whoCooks: [['me', 'Me'], ['partner', 'My partner'], ['share', 'We share'], ['takeout', 'Mostly takeout']],
    schedule: ['Office 9–5', 'Sales — on the road', 'Home with the kids', 'Shifts or it varies', 'Work from home'],
    worked: ['Tracking', 'Cooking at home', 'Walking', 'A partner or group', 'Meal prep', 'A program with a coach'],
    didnt: ['Too strict', 'Too much counting', 'All-or-nothing', 'No time', 'Got bored', 'Injury', 'Stress eating', 'Shabbat and simchas'],
    supplements: ['multivitamin', 'vitamin_d', 'omega3', 'magnesium', 'creatine', 'protein_whey', 'protein_plant', 'psyllium', 'probiotic', 'iron', 'b12', 'prenatal']
  };

  // ------------------------------------------------------------------ sources (verified URLs)
  var SOURCES = {
    ods_weightloss: { title: 'NIH Office of Dietary Supplements — Dietary Supplements for Weight Loss', url: 'https://ods.od.nih.gov/factsheets/WeightLoss-Consumer/' },
    ods_vitd: { title: 'NIH ODS — Vitamin D fact sheet', url: 'https://ods.od.nih.gov/factsheets/VitaminD-Consumer/' },
    ods_omega3: { title: 'NIH ODS — Omega-3 Fatty Acids fact sheet', url: 'https://ods.od.nih.gov/factsheets/Omega3FattyAcids-Consumer/' },
    ods_magnesium: { title: 'NIH ODS — Magnesium fact sheet', url: 'https://ods.od.nih.gov/factsheets/Magnesium-Consumer/' },
    ods_probiotics: { title: 'NIH ODS — Probiotics fact sheet', url: 'https://ods.od.nih.gov/factsheets/Probiotics-Consumer/' },
    ods_exercise: { title: 'NIH ODS — Dietary Supplements for Exercise and Athletic Performance', url: 'https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-Consumer/' },
    ods_mvm: { title: 'NIH ODS — Multivitamin/mineral Supplements fact sheet', url: 'https://ods.od.nih.gov/factsheets/MVMS-Consumer/' },
    issn_creatine: { title: 'Kreider et al. 2017, ISSN position stand: creatine (J Int Soc Sports Nutr)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/' },
    issn_protein: { title: 'Jäger et al. 2017, ISSN position stand: protein and exercise', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/' },
    leidy2015: { title: 'Leidy et al. 2015, The role of protein in weight loss and maintenance (Am J Clin Nutr)', url: 'https://pubmed.ncbi.nlm.nih.gov/25926512/' },
    thompson2017: { title: 'Thompson et al. 2017, Isolated soluble fiber and body weight: meta-analysis (Am J Clin Nutr)', url: 'https://pubmed.ncbi.nlm.nih.gov/29092878/' },
    gibb2023: { title: 'Gibb et al. 2023, Psyllium and weight loss: meta-analysis (authors employed by the maker of Metamucil)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10389520/' },
    medline_psyllium: { title: 'MedlinePlus — Psyllium', url: 'https://medlineplus.gov/druginfo/meds/a601104.html' },
    cleveland_psyllium: { title: 'Cleveland Clinic — Psyllium powder', url: 'https://my.clevelandclinic.org/health/drugs/18922-psyllium-powder-for-solution' },
    wastyk2021: { title: 'Wastyk et al. 2021, Gut-microbiota-targeted diets modulate human immune status (Cell)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9020749/' },
    nccih_berberine: { title: 'NCCIH — Berberine and Weight Loss: What You Need To Know', url: 'https://www.nccih.nih.gov/health/berberine-and-weight-loss-what-you-need-to-know' },
    nccih_greentea: { title: 'NCCIH — Green Tea: Usefulness and Safety', url: 'https://www.nccih.nih.gov/health/green-tea' },
    lopez2022: { title: 'Lopez et al. 2022, Resistance training and body composition in overweight and obesity: meta-analysis (Obes Rev)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9285060/' }
  };

  // ------------------------------------------------------------------ supplements & superfoods
  // rating: overall usefulness for their goals. weightLoss: evidence for weight loss specifically.
  // Ratings: strong | some | weak | not (not recommended) | doctor (only as directed by a doctor)
  var SUPPLEMENTS = [
    { id: 'protein_whey', name: 'Protein powder (whey — dairy)', category: 'supplement', rating: 'some', weightLoss: 'some',
      summary: 'Handy when a meal would be low in protein. Higher-protein eating helps with fullness, and protein plus strength training helps keep muscle while you lose weight. Food first; powder fills gaps.',
      how: 'One scoop (about 20–40 g protein) in place of a low-protein breakfast or snack.',
      timingShort: 'With a meal or after a workout', kosher: 'DAIRY (milchig). Needs a reliable hechsher; choose cholov Yisroel if that is your practice. Not for a meat meal.',
      cautions: 'Kidney disease: ask your doctor first.', contains: ['protein'], sources: ['ods_exercise', 'issn_protein', 'leidy2015'] },
    { id: 'protein_plant', name: 'Protein powder (pea or soy — pareve)', category: 'supplement', rating: 'some', weightLoss: 'some',
      summary: 'Same job as whey, and it works with meat or dairy meals. Useful for a pareve breakfast shake.',
      how: 'One scoop (about 20–40 g protein) when a meal is light on protein.',
      timingShort: 'With a meal', kosher: 'Check that the hechsher says pareve — some plant powders are made on dairy equipment (marked D or DE).',
      cautions: 'Kidney disease: ask your doctor first.', contains: ['protein'], sources: ['ods_exercise', 'issn_protein', 'leidy2015'] },
    { id: 'creatine', name: 'Creatine monohydrate', category: 'supplement', rating: 'strong', weightLoss: 'not',
      summary: 'One of the best-studied supplements: with strength training it helps strength and muscle, and it is considered safe for healthy adults. It is NOT a weight-loss supplement — expect the scale to go up 2–4 lbs of water in the first weeks.',
      how: 'Studied doses are commonly 3–5 g a day, any time of day, every day.',
      timingShort: 'Any time, daily', kosher: 'Plain powder with a hechsher. Avoid gelatin capsules unless certified.',
      cautions: 'Kidney problems, pregnancy, nursing or medications: ask your doctor first.', safeModeNote: 'Not during pregnancy or nursing unless your doctor says so.',
      contains: ['creatine'], sources: ['ods_exercise', 'issn_creatine'] },
    { id: 'vitamin_d', name: 'Vitamin D', category: 'supplement', rating: 'some', weightLoss: 'weak',
      summary: 'Worth taking if a blood test shows you are low. Research does not support vitamin D for weight loss. Test first, then recheck in 2–3 months.',
      how: 'The adult RDA is 600 IU a day; the upper limit is 4,000 IU a day unless your doctor prescribes more. Count the D in any multivitamin.',
      timingShort: 'With a meal', timing: 'Take with a meal that has some fat.', kosher: 'Many D3 products come from lanolin (generally accepted with a hechsher); D2 and vegan D3 also exist. Softgels may be gelatin — look for a hechsher.',
      cautions: 'Ask for a blood test before and after.',
      interactions: [{ match: ['orlistat', 'alli', 'xenical'], note: 'Orlistat can reduce vitamin D absorption.' },
        { match: ['statin', 'atorvastatin', 'lipitor', 'simvastatin', 'rosuvastatin', 'crestor'], note: 'Vitamin D and statins can interact — mention it to your doctor.' },
        { match: ['prednisone', 'steroid', 'methylprednisolone'], note: 'Steroids can lower vitamin D levels.' },
        { match: ['hydrochlorothiazide', 'hctz', 'chlorthalidone', 'thiazide'], note: 'Thiazide water pills plus vitamin D can raise calcium too high.' }],
      contains: ['vitamin_d'], sources: ['ods_vitd'] },
    { id: 'omega3', name: 'Omega-3 (fish oil or algae oil)', category: 'supplement', rating: 'some', weightLoss: 'weak',
      summary: 'Some benefit for heart health, and DHA matters in pregnancy. Weak evidence for weight loss. Eating fish like salmon twice a week covers a lot of it.',
      how: 'Follow the label; up to 5 g a day of EPA+DHA is considered safe by the FDA and EFSA.',
      timingShort: 'With a meal', kosher: 'Fish oil must come from kosher fish with reliable certification. Softgels are often gelatin — look for certified softgels. Algae oil is a pareve, fish-free option.',
      cautions: 'Very high doses (about 4 g a day) slightly raised atrial fibrillation risk in people with heart disease.',
      interactions: [{ match: ['warfarin', 'coumadin', 'jantoven'], note: 'Fish oil may prolong clotting with warfarin.' },
        { match: ['apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'clopidogrel', 'plavix', 'blood thinner'], note: 'You take a blood thinner — ask your doctor before omega-3.' }],
      contains: ['omega3'], sources: ['ods_omega3'] },
    { id: 'psyllium', name: 'Psyllium / fiber supplement', category: 'supplement', rating: 'some', weightLoss: 'some',
      summary: 'Fiber helps fullness. In trials, isolated soluble fiber led to modest weight loss compared with placebo, but results varied a lot. Beans, vegetables and oats come first.',
      how: 'Mix with a full 8 oz glass of water.',
      timingShort: '2+ hours apart from medicines', timing: 'Take at least 2 hours apart from other medicines (3 hours from digoxin, aspirin and nitrofurantoin), with a full glass of water.',
      kosher: 'Plain psyllium husk with a hechsher.',
      cautions: 'Trouble swallowing or a history of bowel blockage: ask your doctor first. Tell your doctor if you are pregnant or nursing.',
      interactions: [{ match: ['digoxin', 'lanoxin'], note: 'Take digoxin at least 3 hours apart from psyllium.' },
        { match: ['aspirin', 'salicylate'], note: 'Take aspirin at least 3 hours apart from psyllium.' },
        { match: ['nitrofurantoin', 'macrobid'], note: 'Take nitrofurantoin at least 3 hours apart from psyllium.' }],
      contains: ['fiber'], sources: ['thompson2017', 'gibb2023', 'medline_psyllium', 'cleveland_psyllium'] },
    { id: 'magnesium', name: 'Magnesium', category: 'supplement', rating: 'weak', weightLoss: 'weak',
      summary: 'Useful if you don\'t get enough from food (nuts, beans, greens, whole grains). Weak evidence for weight loss or sleep.',
      how: 'Don\'t exceed 350 mg a day from supplements (the adult upper limit) unless your doctor says so. Too much causes diarrhea.',
      timingShort: 'Evening, apart from some medicines', kosher: 'Look for a hechsher; capsules may be gelatin.',
      interactions: [{ match: ['alendronate', 'fosamax', 'risedronate', 'actonel', 'ibandronate', 'boniva', 'bisphosphonate'], note: 'Take bisphosphonates at least 2 hours apart from magnesium.' },
        { match: ['doxycycline', 'tetracycline', 'minocycline', 'ciprofloxacin', 'cipro', 'levofloxacin', 'levaquin'], note: 'Take these antibiotics at least 2 hours before or 4–6 hours after magnesium.' },
        { match: ['furosemide', 'lasix', 'hydrochlorothiazide', 'hctz', 'diuretic', 'water pill'], note: 'Water pills can change magnesium levels — ask your doctor.' },
        { match: ['omeprazole', 'prilosec', 'esomeprazole', 'nexium', 'pantoprazole', 'protonix', 'lansoprazole', 'prevacid'], note: 'Long-term acid reducers (PPIs) can lower magnesium — ask your doctor about checking it.' }],
      contains: ['magnesium'], sources: ['ods_magnesium'] },
    { id: 'probiotic', name: 'Probiotic capsules', category: 'supplement', rating: 'weak', weightLoss: 'weak',
      summary: 'No formal recommendation for or against them in healthy people, and weight-loss results are inconsistent. Fermented foods are a better first step.',
      how: 'If you try one, give it a month and drop it if you notice nothing.',
      timingShort: 'With food', kosher: 'Some capsules contain dairy or gelatin — check the hechsher and the D marking.',
      cautions: 'A weakened immune system or serious illness: ask your doctor first.', contains: ['probiotic'], sources: ['ods_probiotics', 'ods_weightloss'] },
    { id: 'multivitamin', name: 'Multivitamin', category: 'supplement', rating: 'weak', weightLoss: 'not',
      summary: 'Can fill small gaps in a limited diet but does not help weight loss. Watch for overlap: most contain vitamin D, magnesium and more.',
      how: 'One a day as labeled.', timingShort: 'With a meal', kosher: 'Look for a hechsher; tablets usually avoid the gelatin issue.',
      contains: ['vitamin_d', 'magnesium', 'b12', 'zinc', 'iron'], sources: ['ods_mvm'] },
    { id: 'prenatal', name: 'Prenatal vitamin', category: 'supplement', rating: 'doctor', weightLoss: 'not',
      summary: 'For pregnancy, trying to conceive, or nursing — as your doctor or midwife directs.',
      how: 'As directed.', timingShort: 'With a meal', kosher: 'Look for a hechsher; some softgels are gelatin.',
      contains: ['vitamin_d', 'iron', 'folate', 'iodine'], sources: [] },
    { id: 'iron', name: 'Iron', category: 'supplement', rating: 'doctor', weightLoss: 'not',
      summary: 'Only if a blood test shows you need it — too much iron is harmful.', how: 'As directed by your doctor.',
      timingShort: 'As directed', kosher: 'Look for a hechsher.', contains: ['iron'], sources: [] },
    { id: 'b12', name: 'Vitamin B12', category: 'supplement', rating: 'doctor', weightLoss: 'not',
      summary: 'Take it if your doctor finds you low (some medicines lower B12).', how: 'As directed by your doctor.',
      timingShort: 'Any time', kosher: 'Look for a hechsher.', contains: ['b12'], sources: [] },
    { id: 'electrolytes', name: 'Electrolyte mix (sugar-free)', category: 'supplement', rating: 'weak', weightLoss: 'not',
      summary: 'Not needed for everyday life — water and normal meals cover it. Can help on a long hot day of heavy sweating or after a stomach bug. Choose sugar-free. (General guidance; there is no strong research for everyday use.)',
      how: 'Occasionally, as labeled.', timingShort: 'As needed', kosher: 'Look for a hechsher.', contains: ['sodium', 'potassium'], sources: [] },
    { id: 'protein_foods', name: 'Protein-rich foods (chicken, fish, eggs, Greek yogurt, cottage cheese, beans)', category: 'food', rating: 'strong', weightLoss: 'some',
      summary: 'Higher-protein eating (about 25–30 g per meal) helps appetite and weight management, and with strength training helps keep muscle while you lose weight.',
      how: 'Protein first at every meal.', kosher: 'Keep meat and dairy meals separate; eggs, fish and beans are pareve.', contains: [], sources: ['leidy2015', 'lopez2022'] },
    { id: 'chia_flax', name: 'Chia seeds and ground flax', category: 'food', rating: 'some', weightLoss: 'weak',
      summary: 'Good sources of fiber and plant omega-3 (ALA). Nice in yogurt or oats; not a weight-loss trick on their own.',
      how: '1–2 tablespoons a day. Flax must be ground.', kosher: 'Pareve; buy with a hechsher.', contains: ['fiber'], sources: ['ods_omega3'] },
    { id: 'fermented', name: 'Fermented foods (yogurt, kefir, sauerkraut, pickles)', category: 'food', rating: 'some', weightLoss: 'weak',
      summary: 'In a small randomized trial, eating more fermented foods increased gut-microbe diversity and lowered inflammation markers. Not a weight-loss study.',
      how: 'A serving most days.', kosher: 'Yogurt and kefir are dairy; sauerkraut and pickles are pareve.', contains: [], sources: ['wastyk2021'] },
    { id: 'green_tea', name: 'Green tea (the drink)', category: 'food', rating: 'some', weightLoss: 'weak',
      summary: 'A fine drink to enjoy. Green tea\'s catechins plus caffeine may have a modest effect on weight. As a drink, no adverse effects have been reported.',
      how: 'A cup or two before noon (it has caffeine).', kosher: 'Plain tea bags are generally fine; flavored teas need a hechsher.',
      interactions: [{ match: ['nadolol', 'corgard', 'atorvastatin', 'lipitor'], note: 'Green tea can lower blood levels of nadolol and atorvastatin.' }],
      contains: ['caffeine'], sources: ['nccih_greentea'] },
    { id: 'green_tea_extract', name: 'Green tea extract (pills)', category: 'supplement', rating: 'not', weightLoss: 'weak',
      summary: 'Any weight effect is small, and green tea extract has been linked to liver damage in dozens of case reports. Drink the tea instead.',
      how: 'Not recommended.', kosher: '—', contains: ['caffeine'], sources: ['ods_weightloss', 'nccih_greentea'] },
    { id: 'caffeine_pills', name: 'Caffeine / "fat burner" pills', category: 'supplement', rating: 'not', weightLoss: 'weak',
      summary: 'Small effects at best. Up to 400 mg of caffeine a day raises no safety concern for most adults (a cup of coffee has about 85–100 mg) — but fat-burner blends add risk, and caffeine after noon hurts sleep.',
      how: 'Not recommended. Coffee or tea before noon is fine.', kosher: '—', contains: ['caffeine'], sources: ['ods_weightloss'],
      safeModeNote: 'In pregnancy keep caffeine moderate; it passes into breast milk.' },
    { id: 'glucomannan', name: 'Glucomannan', category: 'supplement', rating: 'weak', weightLoss: 'weak',
      summary: 'Weight results are inconsistent, and tablets have been linked to choking/esophageal blockage.', how: 'Not recommended as a tablet.', kosher: '—', contains: ['fiber'], sources: ['ods_weightloss'] },
    { id: 'berberine', name: 'Berberine', category: 'supplement', rating: 'not', weightLoss: 'weak',
      summary: 'Popular online, but the evidence is not conclusive and many studies had a high risk of bias. Side effects are mainly stomach upset, it can interact with medicines, and it may be unsafe in pregnancy or nursing.',
      how: 'Not recommended without your doctor.', kosher: '—', interactions: [{ match: ['cyclosporine'], note: 'Berberine can interact with cyclosporine.' }],
      safeModeNote: 'May be unsafe during pregnancy or nursing.', contains: [], sources: ['nccih_berberine'] },
    { id: 'garcinia', name: 'Garcinia cambogia', category: 'supplement', rating: 'not', weightLoss: 'weak',
      summary: 'The weight effect is uncertain, and there are reports of serious liver injury.', how: 'Not recommended.', kosher: '—', contains: [], sources: ['ods_weightloss'] },
    { id: 'raspberry_ketone', name: 'Raspberry ketone', category: 'supplement', rating: 'not', weightLoss: 'weak',
      summary: 'Supplement doses have never been safety-tested in people.', how: 'Not recommended.', kosher: '—', contains: [], sources: ['ods_weightloss'] },
    { id: 'chromium', name: 'Chromium picolinate', category: 'supplement', rating: 'weak', weightLoss: 'weak',
      summary: 'About 1–2 lbs in studies — too small to matter.', how: 'Not worth it for weight loss.', kosher: '—', contains: ['chromium'], sources: ['ods_weightloss'] },
    { id: 'cla', name: 'CLA (conjugated linoleic acid)', category: 'supplement', rating: 'not', weightLoss: 'weak',
      summary: 'A tiny effect of uncertain value, with case reports of liver inflammation.', how: 'Not recommended.', kosher: '—', contains: [], sources: ['ods_weightloss'] }
  ];
  var RATING_LABEL = { strong: 'Strong', some: 'Some', weak: 'Weak', not: 'Not recommended', doctor: 'Doctor-directed' };

  // ------------------------------------------------------------------ chizuk (off by default)
  // Plain paraphrases (marked as such) of sources verified on Sefaria.
  var CHIZUK = [
    { text: 'Keeping your body healthy is part of serving Hashem — it\'s hard to learn and grow when you\'re unwell.', source: 'Rambam, Hilchot De\'ot 4:1', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.1', paraphrase: true },
    { text: 'Eat when you\'re hungry, and stop before you\'re completely full.', source: 'Rambam, Hilchot De\'ot 4:1–2', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.2', paraphrase: true },
    { text: 'Start the day with some exertion before you eat.', source: 'Rambam, Hilchot De\'ot 4:2', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.2', paraphrase: true },
    { text: 'About eight hours of sleep — a third of the day — is enough.', source: 'Rambam, Hilchot De\'ot 4:4', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.4', paraphrase: true },
    { text: 'Regular exercise and not eating to fullness keep illness away and build strength.', source: 'Rambam, Hilchot De\'ot 4:14', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.14', paraphrase: true },
    { text: 'Sitting idle wears down health, even when the food is good.', source: 'Rambam, Hilchot De\'ot 4:15', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.15', paraphrase: true },
    { text: 'These habits are for the healthy; when you\'re ill, follow your doctor.', source: 'Rambam, Hilchot De\'ot 4:21', url: 'https://www.sefaria.org/Mishneh_Torah,_Human_Dispositions.4.21', paraphrase: true },
    { text: 'Guarding your health is a path of serving Hashem: build habits that strengthen you and avoid what harms.', source: 'Kitzur Shulchan Aruch 32:1 (citing Devarim 4:15)', url: 'https://www.sefaria.org/Kitzur_Shulchan_Arukh.32.1', paraphrase: true },
    { text: 'Moderate exercise helps; extremes in either direction harm.', source: 'Kitzur Shulchan Aruch 32:21', url: 'https://www.sefaria.org/Kitzur_Shulchan_Arukh.32.21', paraphrase: true },
    { text: 'Wait a couple of hours after eating before you go to sleep.', source: 'Kitzur Shulchan Aruch 32:6', url: 'https://www.sefaria.org/Kitzur_Shulchan_Arukh.32.6', paraphrase: true },
    { text: 'Moderate sleep at night is healthy; try not to go to sleep hungry or right after a big meal.', source: 'Kitzur Shulchan Aruch 32:23', url: 'https://www.sefaria.org/Kitzur_Shulchan_Arukh.32.23', paraphrase: true }
  ];

  // ------------------------------------------------------------------ voice & copy
  var SAY = {
    yes: 'Logged. Nice work. Keep going.',
    no: 'Got it. No guilt. Tomorrow is a new day.',
    shabbat: 'No workout, no counting. Eat the meals and enjoy them. Protein first, then don\'t think about it.'
  };
  // Round 3.2 (A2): every fixed workout line, word for word. tools/voice-lines.js makes one small mp3 per line and voice
  // from exactly these texts, and the workout says exactly these texts, so the files always match. No names in any line.
  function firstSentence(t) { var x = String(t || '').trim(); var m = /^(.+?[.!?])(\s|$)/.exec(x); return (m ? m[1] : x).replace(/!/g, '.'); }
  var SPOKEN = {
    count: ['3', '2', '1'], rest: 'Rest.', nextUp: 'Next up.', halfway: 'Halfway.', lastSet: 'Last set.',
    warmup: 'Warm-up.', cooldown: 'Cool-down.', complete: 'Workout complete. Nice work.', skip: 'Skip that one.', stop: 'Stop that one.',
    set: function (n) { return 'Set ' + n + '.'; },
    move: function (name, cue) { return name + '. ' + firstSentence(cue); },
    name: function (name) { return name + '.'; },
    step: function (s) { return s.name + '. ' + s.cue; },
    cueLine: firstSentence
  };
  /** The full list of fixed lines: [{ text, cue }] (cue = crisp counting style). */
  function voiceLines() {
    var out = [], seen = {};
    var add = function (text, cue) { if (text && !seen[text]) { seen[text] = 1; out.push({ text: text, cue: !!cue }); } };
    SPOKEN.count.forEach(function (n) { add(n, true); });
    [SPOKEN.rest, SPOKEN.nextUp, SPOKEN.halfway, SPOKEN.lastSet, SPOKEN.warmup, SPOKEN.cooldown, SPOKEN.complete, SPOKEN.skip, SPOKEN.stop].forEach(function (t) { add(t); });
    [2, 3, 4, 5].forEach(function (n) { add(SPOKEN.set(n)); });
    WARMUP.steps.concat(COOLDOWN.steps).forEach(function (s) { add(SPOKEN.step(s)); });
    EXERCISES.forEach(function (e) { add(SPOKEN.move(e.name, e.cue)); add(SPOKEN.name(e.name)); });
    return out;
  }
  var ENCOURAGEMENTS = [
    'Small wins, every day. That is the whole secret.',
    'You don\'t have to be perfect — just don\'t miss twice.',
    'Ten minutes counts. It always counts.',
    'Protein first, then enjoy the meal.',
    'You\'re doing this together. That matters more than any single day.',
    'Consistency beats intensity.',
    'The trend line is patient. Be patient with it.'
  ];

  // ------------------------------------------------------------------ protein (Round 2)
  // One-tap portions you'd recognize. Grams are rounded averages from USDA FoodData Central,
  // shown as "about" — this is a habit nudge, not counting.
  // Round 3: the first seven are the Protein sheet's one-tap grid (D3); the rest are under "+ Something else".
  var PROTEIN_PORTIONS = [
    { id: 'chicken', label: 'Palm-size chicken', g: 30, kind: 'meat' },
    { id: 'beef', label: 'Palm-size beef', g: 30, kind: 'meat' },
    { id: 'fish', label: 'Palm-size fish', g: 25, kind: 'fish' },
    { id: 'tuna', label: 'Can of tuna', g: 25, kind: 'fish' },
    { id: 'eggs', label: '2 eggs', g: 12, kind: 'pareve' },
    { id: 'yogurt', label: 'Greek yogurt cup', g: 15, kind: 'dairy' },
    { id: 'cottage', label: 'Cottage cheese', g: 14, kind: 'dairy' },
    { id: 'cheese', label: 'Cheese, 2 slices', g: 12, kind: 'dairy' },
    { id: 'milk', label: 'Glass of milk', g: 8, kind: 'dairy' },
    { id: 'shake', label: 'Protein shake', g: 25, kind: 'dairy' },
    { id: 'beans', label: 'Beans or lentils, 1 cup', g: 15, kind: 'pareve' },
    { id: 'tofu', label: 'Tofu, ½ block', g: 18, kind: 'pareve' },
    { id: 'nuts', label: 'Handful of nuts', g: 6, kind: 'pareve' }
  ];
  var PROTEIN_IDEAS = {
    meat: ['Grilled chicken thighs with za\'atar', 'London broil, sliced thin, over salad', 'Turkey meatballs in marinara', 'Shawarma-spiced chicken bowl', 'Leftover roast chicken with tahini slaw'],
    dairy: ['Greek yogurt with berries and nuts', 'Cottage cheese with tomatoes and za\'atar', 'Shakshuka with feta', 'Two-egg omelet with cheese and spinach', 'Protein shake with milk and a banana'],
    pareve: ['Hard-boiled eggs (keep 6 in the fridge)', 'Tuna salad on cucumber rounds', 'Lentil soup', 'Baked salmon with lemon', 'Hummus and chickpea salad', 'Tofu stir-fry']
  };

  return {
    VIDEOS: VIDEOS, EXERCISES: EXERCISES, WARMUP: WARMUP, COOLDOWN: COOLDOWN, WALKING: WALKING,
    HABITS: HABITS, FOOD_RULES: FOOD_RULES, SLEEP_RULES: SLEEP_RULES, NOSH: NOSH,
    SECTIONS: SECTIONS, RECIPES: RECIPES, GROCERY_NOTE: GROCERY_NOTE, IF_THEN: IF_THEN, GUIDES: GUIDES, MODES: MODES,
    CHEERS: CHEERS, NUDGE: NUDGE, COUPLE_QUESTIONS: COUPLE_QUESTIONS, REWARD_IDEAS: REWARD_IDEAS, SOS_STEPS: SOS_STEPS,
    PARQ: PARQ, CHOICES: CHOICES, SAY: SAY, SPOKEN: SPOKEN, voiceLines: voiceLines, ENCOURAGEMENTS: ENCOURAGEMENTS,
    SUPPLEMENTS: SUPPLEMENTS, RATING_LABEL: RATING_LABEL, SOURCES: SOURCES, CHIZUK: CHIZUK, yt: yt,
    PROTEIN_PORTIONS: PROTEIN_PORTIONS, PROTEIN_IDEAS: PROTEIN_IDEAS,
    PARQ_URL: 'https://eparmedx.com/'
  };
});
