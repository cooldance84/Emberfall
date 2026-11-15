# Elemental specialisation (design draft)

Status: **draft, not implemented.** Written for v1.17.0. Inspired by Diablo 4 style elemental builds.

## Principles

- The special strikes (U/Q skills) stay exactly as they are.
- The element is an extra layer on the hero. Hits build up a status on the enemy, and the status itself does only minimal damage.
- Physical damage from normal hits is unchanged, so no enemy ever becomes invulnerable and no boss becomes unkillable.
- Balance first: elemental power is about **+3% at level 10 and about +15% at level 70**, never more.

## Choosing and growing the element

- At **level 10** the hero chooses one element: fire, frost or lightning.
- The element gains a new **tier every 10 levels** (10, 20, ... 70, seven tiers, matching the seven acts).
- Each tier adds a new behaviour, not only bigger numbers (see the table).
- Changing element costs **coins at the Blacksmith**. The tiers are kept, so the new element starts at the tier of the hero's current level. A change is a cost, not a punishment.

| Level | Tier | Fire | Frost | Lightning |
|---|---|---|---|---|
| 10 | I | Burning (damage over time) | Chill (slow) | Small chain arc |
| 20 | II | Stronger burn | Faster buildup | Longer arc |
| 30 | III | Burn spreads to nearby enemies | Deep Freeze (short freeze) | Shock (short stun) |
| 40 | IV | Burst of fire on death | Frozen enemies are brittle (take more damage) | Arc hits more targets |
| 50 | V | Burns stack | Longer freeze | Longer stun |
| 60 | VI | Ring of fire around the hero | Frost burst | Lightning strike |
| 70 | VII | Capstone effect per element | Capstone | Capstone |

Details of each tier are tuned during testing.

## Buildup, not chance

Each hit adds **buildup** to the enemy. Buildup decays over time. When it fills, the status triggers.
This is more predictable than a flat proc chance and fits bosses better.

Hero flavour (the main stat scales the buildup):
- **Nolan (STR):** elemental blade, strongest on melee hits.
- **Panni (INT):** stronger and wider status effects.
- **Luca (DEX):** faster buildup, synergy with critical hits.

## Enemies and bosses

- Every enemy and boss has a **weakness** and a **resistance**, matched to the act's theme (for example, fire works better in the frost act).
- **Never full immunity.** Buildup keeps at least **40%** effectiveness, and a resistance reduces it by at most **60%**.
- Bosses have stricter caps on stun and freeze (diminishing returns), so they cannot be locked down.
- The boss bar shows icons for weakness and resistance, so switching element is worth it.
- Elemental enemy attacks (for example the frost archer) make the hero's **resistance** matter.

## Items

- New modifiers: **elemental damage or buildup bonus (%)** and **elemental resistance** (less damage from that element).
- Rare items and above can roll them. Legendary items can come with a fixed element.
- Optional later: forging at the Blacksmith can add an elemental bonus.

## Presentation

- The element's colour on the weapon and the hero's aura. Flames, ice crystals and sparks on affected enemies.
- Selection and changing at the Blacksmith and on the character screen.
- All new text in English and Hungarian.

## Technical notes

- Status state lives on each fighter (buildup per element, active timers) and is updated in the enemy update loop.
- Save compatibility: `rpg` gets an element field and items get optional affixes. Old saves load without them.
- Tests: buildup and decay, tier effects, boss caps (the 40% floor), item modifiers, rendering in every state, Hungarian strings.
- Version for the first release: **v1.18.0**.

## Phases

1. Core system: three statuses, buildup, choice at level 10, tiers.
2. Enemy and boss weakness and resistance tables, icons on the boss bar.
3. Item modifiers and resistances, save compatibility.
4. Visuals, UI and translation.
5. Tests and balance (target: about +3% at level 10 up to about +15% at level 70).

## Decided

- Unlock at level 10, tiers every 10 levels.
- Buildup, not proc chance.
- Superseded in v1.21.0: tiers are bought with gold (tier I free, II 364 ... VII 2830, one tier unlocks per 10 levels). To switch you dismiss the current element at the Blacksmith and get 75% of the gold you put into it back; the new element starts at tier I.

## Status after v1.18.0

Phase 1 and the visuals/translation of phase 4 are done, with a first balance pass. Still open: weakness and resistance icons on the boss bar (the tables already exist), item elemental damage and resistance affixes, a deeper balance pass with items.

## Rock-paper-scissors (v1.22.0)

Frost beats fire, lightning beats frost, fire beats lightning. Each elemental monster resists its own element (x0.6) and is weak to its counter (x1.25); the third is neutral. Bosses: Colossus, Forgemaster and Cinder King are fire, Mire Matron lightning, Wyrm frost.
