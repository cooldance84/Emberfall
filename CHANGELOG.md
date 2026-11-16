# Changelog

All notable changes to Emberfall. Versions follow [Semantic Versioning](https://semver.org).

## [1.35.2] - 2026-11-16
- Paragon is visible from the moment you hit level 70: the level line always carries the blue paragon count (LV 70 +0, +1, +2...), and the thin bar under the health bar becomes a blue bar that fills toward the next paragon point.
- Shrines are more common: about 55% of stages now have one (was 35%), and one stage in nine has two. Two shrines never stand close together.

## [1.35.1] - 2026-11-16
- Chasms fixed: the pit used to be drawn slanted while the game treated it as a straight band, so foes (and heroes) could stand visibly over it without falling, or fall while standing on solid ground. Pits and barricades are now drawn exactly where the rules put them. Foes that back away (archers, casters, retreating soldiers) now stop at the lip of a chasm instead of drifting out over it, soldiers chasing you still hop across, and the fleeing Pilferer jumps over chasms and barricades instead of running on air.

## [1.35.0] - 2026-11-16
- Shrines: now and then (about one stage in three, never on stage 1 of the campaign, always before the boss) a stone shrine stands by the road. Strike it with a sword swing or one of Panni's bolts for a random blessing that the whole party shares: Haste (+25% speed, faster swings and skill cool-down), Fury (+30% damage, elemental damage included), Warding (a barrier worth 40% of your life soaks blows), Wisdom (+50% kill XP, adds to the kill combo), Fortune (+60% gold, +50% gear drops) or Surge (+40% element power, only offered when you have an element). Each lasts 25 to 40 seconds and shows at the top of the HUD with its timer. About 1 shrine in 12 is a golden Sacred shrine: four seconds of invulnerability. A shrine can be used once, falls silent while a boss is on the field, and a new blessing replaces the old one.

## [1.34.1] - 2026-11-16
- Arcane barriers are now worn from the spawn and never cast mid-fight: some foes simply arrive with a barrier (random, 6% of foes in stage 2 rising to 24% from the late stages and in the Trials; none in stage 1, none during boss fights). Ash Warders keep their own barrier but no longer shield their allies; they fire bolts instead.

## [1.34.0] - 2026-11-16
- Kill combo: foes killed within three seconds of each other build a combo, and every kill adds 3% experience to the next ones, up to +75% at 25 kills. Any hit on a hero resets it, and so does three seconds without a kill. The combo and its bonus show on the right of the HUD with a small timer bar, and a blue "COMBO x10 XP +30%" pops up every ten kills. It also speeds up paragon points. The bonus stage keeps its own gold combo.

## [1.33.2] - 2026-11-16
- Ember Wyrm fire fixed: the flame waves used to appear in the hero's lane ahead of the dragon, detached from it. Now the dragon turns into your lane while it winds up, a burst of flame shows at its mouth, and the three waves leave the mouth in its own lane, fanning out to cover the lanes around you. The breath stream follows you more slowly while it burns (0.3 instead of 0.6 lanes per frame), so it stays straight instead of shearing diagonally.

## [1.33.1] - 2026-11-16
- Smoother combat for every hero (Nolan, Panni and Luca): a foe knocked down can now be hit while it lies there or gets up, for half damage, so the combo no longer stalls for two seconds after the knockdown. Foes get up faster (down 42 frames instead of 55, getting up 12 instead of 18) and are protected for a shorter time after rising (14 frames instead of 40). Bosses and heroes are unchanged.
- Luca's daggers reach a little further (38 instead of 32), so chains hold on to a target that is knocked back.
- Measured with a full-stat hero against a pack of six foes in Trial III: Nolan 7.6 s to 6.6 s, Panni 15.7 s to 10 s, Luca about 7 s (Luca is noisier).

## [1.33.0] - 2026-11-16
- Paragon: at level 70 experience keeps counting. Every paragon point (up to 100) gives +0.8% max life, +0.7% damage and 0.3% less damage taken, heals you a little and flashes "+1 PARAGON" in blue. The count shows in blue next to your level ("LV 70 +12") in the game and on the hero screen, where the bar and a PARAGON n/100 line replace the XP bar. A point costs 6000 xp plus 120 per point already earned (roughly 10 to 12 points per Ember Trial). Saved per hero.
- Ember Trials are gentler so the whole game can be finished: each Trial adds 14% foe life (was 20%) and 8% foe damage (was 12%). Measured with a full-stat hero (four Emberheart pieces, two best mythics, all +10, fire VII) against the final boss: Trial X takes about 60 seconds and nine hits to kill you, against 31 seconds and eight hits in the campaign, so the later Trials are a longer, tighter fight but no longer a wall.

## [1.32.0] - 2026-11-16
- Bosses reward a max-level hero better: at level 70 a boss's first drop is always at least legendary, and the set chance of all its drops is 50% higher. A boss kill now yields a set piece about 24% of the time in the campaign (up from about 7%), 28% in Trial I and 35% in Trial III. Regular foes are unchanged (around 1% per brute).

## [1.31.1] - 2026-11-16
- Frost and lightning stack like fire: from elemental tier V every new freeze/shock adds a layer (up to three). Frost layers deepen the slow (and its cap) and raise frostbite damage; lightning layers raise shock damage and the chain damage. Layers fall off when the status ends. Re-balanced so the three elements stay within about 10% of each other on a single target.

## [1.31.0] - 2026-11-16
- A proper finale: clearing the last stage (and every Ember Trial, and the daily challenge) now ends with a big CONGRATULATIONS! screen: a fanfare, fireworks and falling confetti over slowly turning rays of light, and a rank that fades in line by line (HERO OF EMBERFALL, TRIAL n CHAMPION, LEGEND OF THE ASHEN VOW after Trial X, DAILY CHALLENGE COMPLETE). The choices to continue appear after a moment so the celebration cannot be skipped by accident. Hungarian included.

## [1.30.2] - 2026-11-16
- Bonus stage: after the timer you keep going until the chests are smashed and the gear is picked up (at least 1.5 seconds, at most 12), with a bar showing how long is left, before the results panel appears.

## [1.30.1] - 2026-11-16
- Discarding a backpack item now scraps it for gold: 40% of its worth, so deeper and rarer gear pays more (a white starter ring about 6G, a legendary around 330G, a mythic near 1000G). Works with the X key and the phone JUMP button; the amount shows in the item panel.

## [1.30.0] - 2026-11-16
- Frost and lightning now deal damage over time like fire: frostbite ticks every half second while a foe is chilled (more while frozen) with white numbers, and an electrified foe takes shock damage with blue numbers. All lightning damage and arcs are blue now (the element ring too).
- Fixed: burning (and the new ticks) no longer stall while you keep hitting. The burn timer reset on every hit, so a foe you attacked constantly almost never took burn damage. Ticks now follow the clock.
- Elements balanced against each other: single-target totals over a long fight are within about 10% across fire, frost and lightning; against groups fire is still ahead as the damage-over-time spreader (its tier VII blast and spread are weaker than before, 3x to 1.3x and 45 to 28), while frost and lightning gain frostbite and shocks.

## [1.29.3] - 2026-11-16
- Skill rekindle now works for every element: casting a skill on a foe that is still under your element from an earlier hit or skill doubles the effect, once per cast. Fire: BURN x2. Frost: DEEP FREEZE (chill lasts twice as long and slows harder, a frozen foe stays frozen twice as long and can be frozen again sooner). Lightning: OVERCHARGE (an extra chain that hits twice as hard and jumps to one more foe).

## [1.29.2] - 2026-11-16
- Dragon's Wrath is much stronger: its damage now also scales with your damage multiplier and bites a share of each foe's maximum health: 40% to 85% of a regular foe (more jars, more bite) and 15% to 36% of a boss, so it matters against a Cinder King at any depth.
- Fire skills rekindle: casting a skill on a foe that is still burning from before doubles its burn damage (BURN x2) and refreshes the duration, until the fire dies out.

## [1.29.1] - 2026-11-16
- When a boss dies, every other foe on the field dies with it. They still give xp and gold, but drop no gear (only the boss drops loot).

## [1.29.0] - 2026-11-16
- New bonus stage, GOBLIN TREASURY: after every act boss (stages 5, 10, 15, 20, 25 and 30, before the next story chapter) you get ten seconds in a gold-lit hall with fast loot goblins that sprint across the screen and dodge you. They never fight back.
- Each goblin you catch pays gold (scales with your depth and Ember Trial); quick kills build a combo that raises the gold up to x3. About one in five drops a chest to smash open, and the rare golden goblin (three hits) pays four times as much and always drops a golden chest with a gear drop.
- After the timer there is a short moment to smash the chests that are left, then a results panel shows goblins caught and lost, chests opened, best combo and gold earned. Hungarian texts included.

## [1.28.2] - 2026-11-16
- Blacksmith: long item tooltips (set pieces with many stats) no longer run into the forge preview. Set bonus lines are left out there, and the forge gains are packed two to a row when space is tight.

## [1.28.1] - 2026-11-16
- Elemental procs reworked: a hero who has chosen an element only ever procs that element (no mixing). Heroes without an element still get a random element on skill hits.
- Skill hits: 30% chance (10% per tick for the ultimate) of the element's status plus bonus elemental damage worth half a hit at your tier.
- Normal hits can proc too: 3.9% (tier 1) to 6.3% (tier 7), bosses 30% less, with bonus elemental damage worth one more hit (0.9x to 1.4x) and the status. Measured on a brute over 25 seconds this adds roughly +2% at tier 1, +4% at tier 3, +6% at tier 5 and +8% at tier 7.

## [1.28.0] - 2026-11-16
- Skills carry a chance of elemental damage: every skill hit has a 30% chance (10% per hit for the ultimate, which hits every foe 18 times) to proc an element on the foe. Your own element comes up half the time, the other two share the rest. It works even before you have chosen an element (tier 1 effects), and with a chosen element the effect uses your element tier, so a high tier makes the skill's frost freeze and its lightning chain. Normal attacks are unchanged: only your own element builds up.

## [1.27.0] - 2026-11-16
- Set pieces are stronger than any mythic: they are built from mythic stats and then rolled above the best mythic roll (about +40% stats on average), always with the mythic elemental affix chance. A single set piece beats a mythic in ~88% of pairs, 2 pieces plus the bonus add about +13-21% overall power, 4 pieces about +25-42%.
- Because of that, set drops are rarer: 12% of legendary and 30% of mythic drops from item level 50 up (before the Ember Trial luck). Set drops get a green "SET DROP!" banner; old set pieces in existing saves keep their old stats.
- Foes can climb back onto a free wyrmling lying on the stage: the nearest plain soldier runs to it and mounts it (not elites or brutes), at most twice per wyrmling.

## [1.26.1] - 2026-11-16
- Set pieces are green (Diablo style): their backpack slot, icon, tooltip name, forge and shop lists and the item on the ground are drawn in green instead of the rarity colour; the small coloured set marker stays.

## [1.26.0] - 2026-11-16
- The level-70 skill is now a true ultimate with its own version for each hero: Nolan's LEGION OF ASH (spectral swords rain on every foe), Panni's STARFALL (columns of falling stars) and Luca's THOUSAND CUTS (shadow blades streak through every foe).
- For about 4 seconds the hero hovers untouchable while every foe on screen takes non-stop damage and is kept staggered (18 ticks), then a finishing blow knocks them down and heals the party by 15%. Cooldown 25 seconds. Foes off screen are not hit.

## [1.25.2] - 2026-11-15
- Discarding on a phone: only legendary and mythic items ask for a second tap; everything else is dropped at once. (Moved from 1.25.1's wording.)

## [1.25.1] - 2026-11-15
- Phones can finally discard items: in the backpack tap JUMP on the selected item. Legendary and mythic items ask first (tap JUMP again within two seconds), everything else goes at once. The hints in the backpack show the touch buttons on touch devices.
- The browser's own page translation is switched off for the game and its touch buttons (it garbled the button labels); use the in-game language setting instead.

## [1.25.0] - 2026-11-15
- Visual polish: foes that carry an element (bosses, warders, knights, archers, wraiths...) now stand in a thin ring of their element's colour (fire, frost, lightning), so you can read weakness and resistance at a glance.
- The fights leave lasting marks on the floor: dark stains, scorch that still glows for a moment, frost patches, lightning scorch. They fade after about 25 seconds and never outlive the stage.
 - 2026-11-15
- Ember Trials replace the endless "cycles". After the campaign each Trial (I-X) starts again from stage 1 with foes that have 20% more life and hit 12% harder, compounding; difficulty stops growing at Trial X. Within a Trial the stages ramp like the campaign, no more 60-level jumps.
- Rewards grow with the Trials: gold +25% per Trial, set drop chance +15% per Trial, a little extra mythic luck. Clearing Trial I, II and III opens forge levels +8, +9 and +10 (chances 30%, 25%, 20%).
- Emberheart set reworked: 2 pieces +8 STR +12% element power; 4 pieces +8 STR, +25% element power and +30% damage to burning, frozen, stunned or chilled foes.
- Set items pack their tooltip tighter so it fits the panel; Trial names are translated.

## [1.23.0] - 2026-11-15
- Gear sets: three sets (Vowbound: crit, Bulwark: life and resist, Emberheart: strength and element power). Legendary (20%) and mythic (35%) drops from item level 50 up can be set pieces.
- Wear 2 or 4 pieces of one set for a bonus; sets combine freely (2+2, 4+2). The tooltip shows which bonuses are on, counting the item as worn; set pieces carry a coloured marker in the backpack.

## [1.22.3] - 2026-11-15
- Link preview for sharing (Facebook etc.): Open Graph / Twitter meta tags and a 1200x630 cover image (docs/og-image.jpg), page title and description.

## [1.22.2] - 2026-11-15
- The backpack is always sorted: plain items first, then magic, rare, legendary, mythic; inside a rarity by slot and then the higher item level first. It re-sorts on pickup, equip, unequip and load.
- Barriers are one-time: a barrier mage no longer re-raises its own shield after you break it, and an ally can only be shielded once.

## [1.22.1] - 2026-11-15
- The VS EQUIPPED comparison now also shows element power and resist differences (green gain, red loss), so you see what you lose when you swap an item.

## [1.22.0] - 2026-11-15
- Elements now play rock-paper-scissors: frost beats fire, lightning beats frost, fire beats lightning. Every elemental monster resists its own element (x0.6) and is weak to the one that beats it (x1.25); the third element is neutral. Nothing is ever immune.
- The old table was uneven (the fire-themed Cinder King was weak to lightning). Now: Cinder King, Cinder Colossus and Forgemaster are fire (frost is best); Mire Matron is lightning (fire is best); the Wyrm is frost (lightning is best). Regular monsters follow the same rule, for example bombers are fire, archers and wraiths frost, wisps and warders lightning.
- Their attacks carry the same elements, so your fire/frost/lightning resist gear counts against the matching monsters.
- The ELEMENTS help page and the weakness icons on the bars show the cycle.

## [1.21.1] - 2026-11-15
- Item level matters more: a level 50 item is now clearly stronger than a level 35 one of the same rarity (about 30% more instead of 22%, and it wins 80% of the time instead of 68%). Level 70 items are unchanged; lower-level items are a bit weaker than before, so the climb feels steeper.
- The roll quality range is a little narrower (a poor roll hurts less), a great legendary still beats a poor mythic about one time in ten.
- Items you already own keep their stats.

## [1.21.0] - 2026-11-15
- Elements are now earned, not just given by level. Choosing an element at the Blacksmith is free and starts at tier I; every further tier (one more unlocks each 10 levels) is bought with gold: II 364, III 696, IV 1103, V 1597, VI 2174, VII 2830.
- To switch element you first dismiss the current one at the Blacksmith (it asks you to press Enter twice). You get 75% of the gold you put into it back, and the next element starts again at tier I.
- Older saves keep the tiers they had already earned. The level-up message now says when a new tier is ready to buy.
- The ELEMENTS help page in the pause menu explains the new rules.

## [1.20.0] - 2026-11-15
- Elemental gear: magic and better items can roll "+% <element> POWER" (boosts your own element's buildup and damage) and "+% <element> RESIST" (cuts damage from monsters of that element, up to 60%). Fire comes from bombers, bosses, vents and fire waves; frost from archers and wraiths; lightning from wisps, witches and knights.
- Boss bar and target bar now show each monster's weak (green arrow up) and resistant (red arrow down) elements once you reach level 10.
- Treasure chest variety: golden chests (3 hits, triple gold, a rare-or-better item) and trapped chests (an ambush of husks, but 60% more gold).
- Daily challenge (key 3 or tap the title line): five stages with a fresh level-1 hero, one rule of the day (Gold Rush, Glass Cannon, Iron Foes, Swift Foes, Treasure Day) and its own daily leaderboard (A/D on the board screen switches all-time and today). Your real hero and run are never touched.
- Forged gear: other armor pieces forged to +5 or more now make your hero glow and throw golden sparks too, not only the weapon.
- New sounds for burning, freezing, lightning arcs and shattering.
- Pause menu: a new ELEMENTS page explains how the system works and shows your tier.
- Touch: the keyboard hints no longer sit under the touch buttons on the title screen.

## [1.19.6] - 2026-11-15
- Fix: a frozen enemy was covered by a white box that did not fit the sprite (it was too big on bosses). Frozen foes now turn icy blue in their own shape, with a soft glow and ice flecks.

## [1.19.5] - 2026-11-15
- Dragon's Wrath needs only an Ember Jar now; the mana bar is gone. Each jar still adds 15% to the wrath.

## [1.19.4] - 2026-11-15
- Dragon's Wrath now needs both full mana (60) and at least one Ember Jar. The HUD tells you when only the jar is missing.

## [1.19.3] - 2026-11-15
- The Blacksmith marks worn items with an EQUIPPED label, in the list and above the item card.

## [1.19.2] - 2026-11-15
- Fix: the game stayed black for heroes who had already chosen an element (the saved element was read before the element code was defined).

## [1.19.1] - 2026-11-15
- The Blacksmith now forges all your gear: every worn item (helm, armor, boots, ring, amulet, weapon) and everything in your pack, up to +7. The list scrolls when it is long.
- Weapons keep +10% stats and +2 main stat per level; other gear gets +6% and +1 per level, so forging everything stays balanced.

## [1.19.0] - 2026-11-15
- Loot with a chase: every item now rolls a quality (shown as ROLL %). Most are average, a few are near perfect (a PERFECT ROLL! message appears at 90%+).
- Rarities overlap: a great legendary beats a poor mythic about one time in seven, while a mythic is still clearly stronger on average. Item level still matters: a higher-level legendary beats a lower-level mythic.
- Now and then an item drops a few levels above you, something to level up for.
- Level luck: higher levels raise the legendary and mythic drop chances a little (about +3.5% and +2% at level 70).
- Older items keep working; they simply show no roll.

## [1.18.3] - 2026-11-15
- Dragon's Wrath now bursts open every treasure chest on screen.

## [1.18.2] - 2026-11-15
- Fix: Panni's arcane bolts and the Dragon shockwaves now open treasure chests too (before, her bolts flew over them).

## [1.18.1] - 2026-11-15
- Treasure chests along the road: 2 to 4 per stage, hidden before the boss arena. Hit one twice to open it for gold (more in later stages), with a small chance of a meat drop.

## [1.18.0] - 2026-11-15
- Elemental specialisation: at level 10 you choose Fire, Frost or Lightning at the Blacksmith (the first choice is free). Your element gains a new tier every 10 levels, up to tier VII at level 70.
- Your hits build up a status on enemies; at 100 it triggers: Burning (damage over time), Chill and Deep Freeze, or lightning arcs that shock and stun. Special strikes (U/Q) are unchanged and also build the status.
- Every tier adds a behaviour (burn spread, eruptions on death, stacking burns, a ring of fire, frozen foes take +20%, frost bursts, shattering, arcs to 2-3 foes, lightning strikes).
- Enemies are weak to some elements and resist others, but nothing is immune: bosses build the status more slowly, their freeze and stun are shorter and have a cooldown.
- Changing element later costs gold at the Blacksmith; your tiers are kept. The element is saved per hero, shown in the character panel and tints the weapon glow.
- Balance: about +3% damage at level 10, about +14% at level 70 for a single target (fire); frost and lightning pay back in control and in groups.
- Hungarian translation for all new texts.

## [1.17.0] - 2026-11-15
- The Blacksmith: after the Ember Market at the end of every stage, you can forge your weapons (worn or in your pack) up to +7 for gold.
- Every forge level adds 10% to all of the weapon's stats and +2 to your main stat (STR, INT or DEX). The price grows with each level, item level and rarity.
- Forging is safe up to +3; after that the chance drops (80%, 65%, 50%, 35% for +7). A failure keeps the level but the gold is spent.
- Weapons forged to +3 or more glow, brighter with every level, and show their level in the name (e.g. "Dawnbreaker +5").

## [1.16.0] - 2026-11-15
- New item rarity: Rare (yellow), between Magic (blue) and Legendary (orange-brown). Rare items roll 3 or 4 stats, drop at about 15% from stage 3, sell for more than magic items and show up in the market too.
- Rare gear tints your hero gold-yellow; legendary keeps its orange-brown tint, mythic its crimson.
- Old saves are converted automatically: your legendary and mythic items stay legendary and mythic.

## [1.15.0] - 2026-11-15
- You can now hold up to 9 continue coins (was 3) and buy several in the Ember Market. The first ones cost 600 gold; once you hold three or more, each extra coin costs 300 gold more than the last.
- The coin display shows a count when you hold more than three.

## [1.14.1] - 2026-11-15
- Healing food now stays on the ground while you are at full health, so you can come back for it after you take damage. In co-op it goes to the player who needs it.

## [1.14.0] - 2026-11-15
- The campaign now has seven acts and 35 stages (was four acts, 20 stages), with seven Heart-Embers to recover.
- Fifteen new stages in three new acts: the Withered Wilds (green fog and rain), the Gilded Dunes (gold and sparks) and the Eclipse Gate (a dark blood eclipse). The old fourth act (the Last Road to the First Flame) is now act VII, the finale.
- New story scenes between the acts, in English and Hungarian.
- Bosses go up to VII (Cinder King VII, Ember Wyrm VII).
- Monster health tiers for every act (+20% up to +180% in act VII), and stage difficulty and XP are re-paced to the longer story: level 70 now arrives around stage 33.

## [1.13.0] - 2026-11-15
- Your run is now saved on the device you play on (stage, cycle, coins, gold, score, for each hero). When you come back and pick the same hero, you can continue that stage for one continue coin, or start a new campaign and lose the old run. With no coins left, the run is over.
- Monster health grows by tier: act II monsters have 20% more health, act III 45%, act IV 75%, and the Ashen Cycles more on top.
- Monsters follow your progress: an over-levelled hero (more than 12 levels above the stage) meets monsters of their own level, so replaying early stages at level 70 is no longer a walk.

## [1.12.0] - 2026-11-15
- Three playable heroes with their own saves: Nolan (STR warrior), Panni (INT sorceress with ranged arcane bolts and faster Dragon's Wrath) and Luca (DEX rogue with fast twin-dagger combos, higher crit and +50% backstabs). Pick on the new hero select screen; in co-op the second player picks too.
- Each hero has their own look: Panni wears a pointed hat and Luca a hood and scarf, and both change with gear rarity like Nolan's helm. Weapons have their own names (staves and daggers), and the story uses the chosen hero's name.
- Fixed a bug where a hero hit in mid-air (or during a jumping skill) stayed floating above their shadow. A blow in the air now knocks you down, and anyone left aloft falls back to the ground.
- Falling into a chasm now costs 60% of your maximum health, and kills you if you have less than that.
- Level 70 is no longer near-invincible: crit chance, crit damage and the main stat have soft caps, and monsters ramp up faster in the second half of the campaign and in the Ashen Cycles.

## [1.11.0] - 2026-11-15
- New monster: Ash Warder (from stage 2). It is invulnerable inside an arcane barrier until you break it; heavy blows crack the barrier fastest, and the warder also shields nearby allies. The barrier slowly returns if you leave it alone.
- New monster: Flame Caller (from stage 3). It marks the ground under you with runes that explode and leave burning pools.
- Chasms to jump over and barricades to vault on every stage. Falling cost 12% health (60% from 1.12.0); monsters knocked into a chasm die.
- Elite monsters (from stage 3), and ambushes that send in reinforcements near the end of a wave.
- Monsters move about 30% faster and attack more often.
- Bosses have 35% more health and 30% more poise, hit 15% harder, attack more often and summon escorts when they enrage.
- Wyrmling riders are much rarer: at most one per wave.
- Hungarian text for all new names and messages.

## [1.10.0] - 2026-11-15
- Nolan's look now follows his gear: leather tunic with no armour, and rarity tiers for helm, armour, boots, amulet gem and blade (up to a flaming sword and crown of flame at mythic).
- Three new monsters: Frost Archer (act II), Blaze Bomber (act III) and Hollow Knight (act IV). Later acts mix them into the waves; boss waves are unchanged.
- Bosses now have articulated limbs: Colossus back-arm, Matron ghost arms and hair tendrils, Forgemaster tongs arm, and bone-jointed flame wings on the Cinder King.
- Hungarian names for the new monsters.

## [1.9.2] - 2026-11-14
- Fixed the RIDE touch button: it now mounts a nearby wyrmling as well as dismounting (E on keyboard does the same).

## [1.9.1] - 2026-11-14
- English is now the default language; Hungarian is opt-in (title screen or pause menu) and remembered.

## [1.9.0] - 2026-11-14
- Added a full Hungarian translation (UI, story, stages, items, skills). Switch language on the title screen (H or click) or in the pause menu; the choice is saved.

## [1.8.2] - 2026-11-14
- Renamed the hero from Kestrel to Nolan.

## [1.8.1] - 2026-11-14
- The Ember Market now has a mythic chance (about 3%) on its regular shelves from stage 3 and a fourth premium shelf with about 6% mythic and 30% legendary or better.

## [1.8.0] - 2026-11-14
- Added a colour palette for each act (frost, crimson, violet) applied to every stage background, so stages 6 to 20 look new.
- Added weather: rain, thunderstorms with lightning flashes, snow, blizzards, ash, forge sparks and drifting light motes.
- Story scenes use the palette of the stage they lead to.

## [1.7.0] - 2026-11-14
- Extended the campaign from 5 to 20 stages in four acts, with new stage names, act-ending story scenes and returning bosses (II, III, IV).
- Rebalanced XP so level 70 can be reached within one run of the campaign; later enemies scale with the stage.
- Ashen Cycles now start much tougher after the 20th stage.

## [1.6.0] - 2026-11-14
- Added three wyrmling kinds with different looks, speed, jump height, health and attacks: Ember, Storm (chain lightning) and Stone (shockwave and landing stomp).
- Added firing in mid-air while riding.
- Changed riding: a hit throws you off but the wyrmling waits so you can remount; a second fall makes it bolt for good.

## [1.5.0] - 2026-11-14
- Added 25 seconds of loot time after each boss before the stage ends (Enter skips it).
- Added gold from kills and a duplicate-item rule: an item you already own becomes gold and score.
- Added the Ember Market after every boss: full heal, continue coin and three gear items for sale.
- Made monsters a little tougher: more health and damage per stage and cycle.

## [1.4.0] - 2026-11-14
- Added original framed portraits of Nolan and each boss to the story scenes.
- Added boss secondary motion: breathing, a hovering Mire Matron with spirit lights, Forgemaster smoke, Cinder King flame wings and Colossus footfall dust.

## [1.3.0] - 2026-11-14
- Added ember vents on stages 2 to 5: a glowing warning, then an eruption that burns anyone standing on them, monsters included.
- Added slash flashes on every hit, larger on knockdowns.
- Added slanting light rays and swaying hanging chains to every stage background.
- Widened Whirlwind and Rising Slash reach.

## [1.2.0] - 2026-11-14
- Added a clickable donate button (or press D) on the title, game-over and victory screens, and a Support section in the README.

## [1.1.0] - 2026-11-14
- Added stage-by-stage difficulty scaling for monster health and damage.
- Added endless Ashen Cycles so level 70 can be reached; the leatherboard records the cycle.
- Added seven special skills unlocked every 10 levels (U to cast, Q to swap), with cooldowns and a pause-menu skills page.
- Added item levels with level requirements for equipping.
- Lowered drop rates: magic 34%, legendary 7%, mythic 1%.

## [1.0.0] - 2026-11-14
- Added a gear-look system: equipped rarity tints the hero and gives legendary or mythic gear an aura.
- Added a new stage monster for each of stages 2 to 5: Bog Wisp, Slag Runner, Throne Guard and Ember Wraith.
- Added letterboxed boss intro cutscenes with a name card and roar.
- Added a procedural music score for each stage, faster during boss fights.
- Added a pause menu (Esc or P) with music, sound effects and CRT toggles, a controls list and quit to title. Settings are saved.
- Added gamepad support (two pads in co-op) and on-screen touch controls.
- Added 2-player local co-op with a shared party and coin revives.
- Polished the story screens (full themed scene), redrew the Ember Wyrm with wings, horns and lava cracks, and fixed overlapping loot labels.
- Added the version number to the title screen and this changelog.

## [0.6.0] - 2026-11-14
- Added the RPG layer: levels up to 70, items with STR, crit chance, crit damage and hit chance, six gear slots and a gear screen.
- Added loot rarity by stage (white, magic, legendary 10%, mythic 3%).
- Added stage 5, the Heart-Ember Sanctum, with the Ember Wyrm final boss.
- Added 3 continue coins per run and the saved Leatherboard.

## [0.5.1] - 2026-11-14
- Waves grow larger on each stage, with more mounted enemies.

## [0.5.0] - 2026-11-14
- The wyrmling's fire breath now comes out of its mouth.

## [0.4.0] - 2026-11-13
- Added the story campaign: four themed stages, three new bosses (Mire Matron, Forgemaster, Cinder King), story screens and continue after death.

## [0.3.0] - 2026-11-12
- Added rideable wyrmling mounts, pilferer imps carrying Ember Jars and the Shift Dragon's Wrath magic.

## [0.2.0] - 2026-11-12
- Graphics pass: shaded and outlined fighters, weapons, castles, banners, fog and flagstone floors.

## [0.1.0] - 2026-11-12
- First release: an original side-scrolling brawler with lighting, particles and a CRT shader.
