# Changelog

All notable changes to Emberfall. Versions follow [Semantic Versioning](https://semver.org).

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
