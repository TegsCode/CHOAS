# CHAOS --- Game Design Document

**Document:** `GAME.md`\
**Version:** 0.1 --- consolidated design draft\
**Status:** Core direction confirmed; individual Mech concepts and
several implementation details remain proposals.\
**Working title:** CHAOS (placeholder)

------------------------------------------------------------------------

## 1. Game Overview

### 1.1 High concept

CHAOS is a 2.5D multiplayer physics arena brawler in which 4--8 players
fight inside compact, dangerous arenas. Players use expressive movement,
grappling, momentum, attacks, defence and the environment to knock
opponents out of the arena or into hazards.

The game combines two experiences:

-   **Funny, unpredictable chaos:** collisions, ragdoll reactions,
    failed launches, accidental saves, environmental destruction and
    unexpected reversals.
-   **Competitive skill:** movement control, timing, positioning,
    momentum management, grappling, defensive decisions and clever use
    of the arena.

The central design principle is that chaos should emerge from the
interaction of understandable mechanics. Individual actions should be
easy to understand, while combining them should create depth and
surprising outcomes.

### 1.2 The intended player experience

A player should be able to understand the immediate situation by
watching a short clip: someone is about to be knocked off a platform, a
grapple changes the trajectory, another player intervenes, and the
situation turns into a spectacular reversal.

A match should regularly create moments that players want to share
because they are funny, impressive, unfair-looking-but-legitimate, or
intensely competitive.

The game should not depend on scripted comedy or random events to be
entertaining. Its physics, player interactions and arena design should
generate the stories.

### 1.3 Design pillars

1.  **Physics creates the stories.** Momentum, collisions, grappling and
    environmental interactions should combine in meaningful ways.
2.  **Simple inputs, deep mastery.** The core actions should be easy to
    learn, but difficult to master in combination.
3.  **Readable chaos.** Spectators should be able to tell what happened,
    even when the outcome is ridiculous.
4.  **Every player can affect the fight.** Movement, attacks, defence,
    grapples and arena hazards should create opportunities for every
    player.
5.  **Skill must matter.** Randomness and physics should create
    surprises, not erase player decisions.
6.  **Fast matches, memorable moments.** The main mode should get
    players into action quickly and end before the match becomes stale.

------------------------------------------------------------------------

## 2. Game Format

  -----------------------------------------------------------------------
  Category                            Current design
  ----------------------------------- -----------------------------------
  Genre                               Multiplayer physics arena brawler

  Perspective                         2.5D

  Camera                              Side-view

  Players                             4--8 per match

  Character style                     Funny, exaggerated ragdoll
                                      characters

  Main experience                     Chaotic and competitive

  Main mode                           Last player standing

  Main elimination                    Knock opponents out of the arena or
                                      into hazards

  Match length target                 Approximately 2--4 minutes (design
                                      target, not yet playtested)

  Arena direction                     Compact, highly interactive and
                                      destructible

  Working title                       CHAOS (placeholder)
  -----------------------------------------------------------------------

### 2.1 2.5D presentation

The game is presented from a side-view camera. Characters and
environments use 3D visuals, while gameplay movement is constrained to a
2D plane.

The 3D presentation gives characters volume, expressive ragdoll motion,
lighting, materials and satisfying impacts without turning the game into
a fully three-dimensional movement game.

The camera should keep the action readable. It should show the important
parts of the arena and avoid making players lose track of their
character during fast movement.

### 2.2 Player count

The target is 4--8 players in a match. Arenas, hazard placement and
match pacing should be designed around this range. The game should
remain readable with eight players without making the arena feel empty
with four.

### 2.3 Match pacing

The target match duration is approximately 2--4 minutes. This is a
target to validate through playtesting, not a hard technical rule.

The main mode should begin quickly, create immediate conflict and
maintain pressure as the number of surviving players decreases.

------------------------------------------------------------------------

## 3. Main Game Mode

### 3.1 Last Player Standing

The primary mode is a free-for-all survival brawl.

-   All players enter the arena.
-   Players fight using movement, attacks, defence, grappling and the
    environment.
-   A player is eliminated when knocked out of the arena or into a
    lethal arena hazard.
-   The last surviving player wins.
-   The initial design is **no respawns** in this main mode.

The arena should make positioning matter. A player near an edge may have
a strong attacking angle but is also vulnerable to being knocked out.
Players should be able to recover from danger through movement and
grappling when their timing and position allow it.

### 3.2 Additional mode concepts

These are planned mode directions, not fully specified or confirmed
rules.

**Team Chaos** - Players are divided into teams. - Teams attempt to
eliminate the opposing team. - Team size, respawn rules and scoring
still need to be designed.

**King of the Platform** - Players fight to control a designated
platform or area. - The mode should reward positioning and the ability
to displace opponents. - Capture duration, scoring and round structure
remain undecided.

**Respawn / high-elimination mode** - A faster mode where players can
return after being eliminated. - The goal would be repeated eliminations
rather than survival until one player remains. - Exact scoring and
respawn rules remain undecided.

------------------------------------------------------------------------

## 4. Core Gameplay Loop

1.  Players enter a compact arena.
2.  They move, position themselves and look for opportunities.
3.  They use attacks, defence, grapples and environmental features to
    create an advantage.
4.  Momentum and collisions create opportunities or dangerous mistakes.
5.  Players attempt to knock opponents out or survive incoming attacks.
6.  The arena becomes more dangerous as the fight develops.
7.  The last surviving player wins.
8.  Players return to the next match, with progression and unlocks
    providing longer-term goals.

The loop should be quick to repeat. Players should not spend most of a
match travelling across empty space or waiting for something to happen.

------------------------------------------------------------------------

## 5. Player Movement Kit

The movement kit is deliberately limited to the following defined
mechanics. Do not add extra fundamental movement abilities without
revisiting the design.

### 5.1 Core movement mechanics

  -----------------------------------------------------------------------
  Mechanic                Intended function       Design notes
  ----------------------- ----------------------- -----------------------
  Run                     Standard ground         Primary way to move and
                          movement                build or maintain
                                                  ground speed.

  Jump                    Leave the ground        Fundamental vertical
                                                  movement and the
                                                  starting point for many
                                                  combinations.

  Double Jump             Perform a second jump   Provides an additional
                          while airborne          air-movement
                                                  opportunity.

  Dash                    Rapid movement burst    Used for repositioning,
                                                  dodging, closing
                                                  distance and changing
                                                  momentum.

  Slide                   Low-profile ground      Useful for movement
                          movement                under/around threats
                                                  and for carrying ground
                                                  momentum.

  Wall Jump               Jump away from a        Lets players use arena
                          suitable wall           walls as movement
                                                  surfaces and recovery
                                                  opportunities.

  Grapple                 Attach to a valid       A central movement and
                          surface or another      interaction mechanic.
                          player                  

  Swing                   Move around a grapple   Swinging should
                          attachment using        preserve and
                          momentum                communicate momentum
                                                  rather than simply
                                                  teleporting the player.

  Pull                    Pull while grappling    **Can only be performed
                                                  while grappling.** It
                                                  is not a standalone
                                                  movement action.

  Ledge Grab              Catch or hold a ledge   Only possible when the
                          when within a defined   player is close enough
                          distance                to a valid ledge. Exact
                                                  catch distance and
                                                  input/automatic
                                                  behaviour are still to
                                                  be tuned.

  Dive                    Commit to a             Can be used to attack
                          downward/forward air    space, change
                          movement                trajectory or create
                                                  impact opportunities.
  -----------------------------------------------------------------------

### 5.2 Explicit exclusion

**Air Recovery is removed.** It is not part of the movement kit and
should not be reintroduced as a standard mechanic or an assumed recovery
action.

### 5.3 Grapple rules

The currently selected grapple targets are:

-   **Surfaces**
-   **Other players**

A grapple should be a meaningful part of the physics system. Attaching
to a surface can create swings, launches and movement routes. Attaching
to another player can create direct player-versus-player interactions,
including changes in spacing and trajectory.

The exact rules for grapple range, attachment validation, breaking free,
target resistance and grapple duration are not yet finalised.

### 5.4 Ledge grab rules

Ledge grab is proximity-limited. A player can only grab a valid ledge
when they are within a defined distance of it. This should create
dramatic near-fall recovery opportunities without allowing players to
catch ledges from implausible distances.

Whether ledge grabbing is automatic when in range or requires a player
input remains an open implementation decision.

------------------------------------------------------------------------

## 6. Combat: Attack and Defend

Attack and Defend are the only additional fundamental player actions
beyond the movement kit.

They are not movement mechanics and are not currently included as
components in Mech combinations.

### 6.1 Attack

Attack gives players a direct way to contest opponents rather than
relying entirely on environmental hazards.

The intended combat direction is physical and momentum-aware. An attack
should interact with the target's position and movement, and should be
capable of creating knockback or disrupting an opponent.

The following details still need design and playtesting: - Attack input
and animation. - Whether there are multiple attack types. - Attack range
and active frames. - Knockback scaling and hit reaction. - Whether an
attack can be interrupted. - How attacks interact with grappling,
sliding, diving and airborne players.

Do not assume a weapon system, combo tree or special attack roster at
this stage.

### 6.2 Defend

Defend gives players a deliberate way to respond to attacks.

The exact defensive implementation is not yet decided. It could involve
timing, posture, reduced knockback or another readable defensive
response, but no one implementation should be treated as confirmed yet.

Defence should create a decision, not make a player invulnerable. It
should have clear visual feedback and counterplay.

------------------------------------------------------------------------

## 7. Physics and Player Interaction

Physics is a core feature, not just a visual effect.

### 7.1 Momentum

Movement actions should interact with the character's existing velocity.
Avoid resetting movement speed unnecessarily when a player jumps,
swings, releases a grapple or changes movement state.

Examples of intended behaviour: - Running before a jump should matter to
the resulting movement. - Swinging should build momentum. - Releasing a
grapple should preserve meaningful swing momentum. - Dashing should
alter velocity in a controlled direction. - Diving should change the
player's trajectory and create a committed movement option. - Collisions
should be able to redirect or reduce momentum.

The exact physical model, acceleration values, speed limits, friction
and air control need tuning through a playable prototype.

### 7.2 Ragdoll character behaviour

Characters should have exaggerated, readable physical reactions. Impacts
should feel substantial, and characters should visibly react to
collisions and knockback.

Ragdoll presentation must not make control feel arbitrary. The game
needs a clear distinction between: - A player-controlled movement
action. - A hit reaction or temporary loss of control. - A full
elimination.

The exact balance between animation-driven movement and physics-driven
ragdoll simulation remains an implementation task.

### 7.3 Player-versus-player interaction

Players should be able to affect one another through: - Grappling
another player. - Pulling while attached by a grapple. - Colliding with
opponents. - Attacking and defending. - Using momentum to displace or
evade opponents.

These interactions should be consistent enough to learn, but expressive
enough to produce surprising outcomes.

------------------------------------------------------------------------

## 8. Arena Design

Arenas should be compact, highly interactive and destructible. They
should create movement choices and danger rather than functioning as
flat backgrounds.

### 8.1 Arena principles

-   Multiple routes and elevations should create positioning decisions.
-   Surfaces should provide useful grapple opportunities.
-   Edges should be dangerous but not make every encounter an instant
    elimination.
-   Hazards should be readable before they cause an elimination.
-   Destruction should change the arena in ways players can understand.
-   Environmental objects and moving machinery may create additional
    interactions, but their exact physics and role need to be defined.
-   Arena layouts should support all 4--8 players.

### 8.2 Initial arena concepts

These are proposed starting arenas.

#### Factory

**Theme:** Industrial production facility.

Potential features: - Conveyor belts that move players and objects. -
Large machinery that creates dangerous zones. - Barrels or movable
industrial objects. - Suspended objects or platforms. - Destructible
sections and exposed hazards.

**Gameplay purpose:** Create moving threats, forced repositioning and
opportunities to use momentum against opponents.

#### Floating Islands

**Theme:** Disconnected platforms suspended over a lethal drop.

Potential features: - Gaps between islands. - Grapple-friendly anchor
surfaces. - Narrow platforms and exposed edges. - Sections that collapse
or break away. - Routes that reward well-timed jumps, swings and dashes.

**Gameplay purpose:** Make movement mastery and recovery important. A
missed grapple or mistimed jump should be dangerous, while a successful
swing can create a spectacular return.

#### Furnace

**Theme:** A dangerous industrial or volcanic environment.

Potential features: - Lava or another lethal floor hazard. - Moving
platforms. - Explosive environmental objects. - Areas that become unsafe
at intervals. - Grapple points over dangerous gaps.

**Gameplay purpose:** Keep players moving and make arena awareness as
important as fighting.

The names and feature lists are concept-stage material. Final layouts,
hazard timings and destruction rules have not been approved.

------------------------------------------------------------------------

## 9. Mech System

### 9.1 Definition

A **Mech** is a developer-designed combination of up to three mechanics
from the established movement kit. When the player performs the required
combination correctly, the Mech activates automatically and produces
both a visual effect and a gameplay effect.

Mechs are authored features of the game. They are not ordinary movement
sequences that happen to work well.

### 9.2 Confirmed Mech rules

  -----------------------------------------------------------------------
  Decision                            Confirmed rule
  ----------------------------------- -----------------------------------
  Availability during a match         All unlocked Mechs are available.

  Activation                          Automatic when the required
                                      combination is performed correctly.

  Effects                             Both visual and mechanical effects.

  Combination size                    Up to three movement mechanics.

  Components                          Only mechanics from the defined
                                      movement kit.

  Dedicated activation button         Not required by the current design.

  Selection loadout                   Players do not have to restrict
                                      themselves to one, three or five
                                      equipped Mechs; all unlocked Mechs
                                      are available.
  -----------------------------------------------------------------------

### 9.3 Activation design

A Mech recognises a specific movement pattern. The game checks whether
the player has performed the required actions and activates the
corresponding effect.

The exact recognition rules are not yet finalised. Each Mech will
need: - A trigger pattern, including whether order matters. - A valid
time window, if required. - Conditions that prevent accidental
activation. - A clear activation cue. - A defined effect duration. - A
recovery or repeat-activation rule, if testing shows one is needed.

**Important open question:** Whether a Mech can activate repeatedly as
soon as its combination is performed again, or whether it needs a
cooldown, airtime restriction or another limit. No repeat-activation
rule has been confirmed yet.

### 9.4 Mech balance principles

-   A Mech should create an opportunity, not guarantee an elimination.
-   Its visual effect should communicate what is happening.
-   Its mechanical effect should be strong enough to feel special but
    not invalidate ordinary movement.
-   The trigger should be achievable through deliberate play.
-   A failed attempt should not cause confusing or unfair behaviour.
-   Mechs should have counterplay and should not all solve the same
    situation.
-   All unlocked Mechs being available should create freedom, not an
    overwhelming number of simultaneous effects.

### 9.5 Initial Mech concepts

The following six Mechs are the current proposed starting concepts.
Their names, combinations and effects are proposals to refine through
prototyping, not a final locked roster.

#### 1. PHANTOM

**Combination:** Dash → Double Jump\
**Role:** Evasion and repositioning.

**Visual effect** - The character briefly takes on a vivid purple
appearance. - A short trail of translucent purple afterimages follows
the character. - The afterimages fade quickly, making the burst readable
without obscuring other players. - A distinct activation flash and sound
communicate the moment the Mech triggers.

**Gameplay effect** - For a very brief duration, the character can pass
through other players without being stopped or redirected by their
bodies. - The effect is temporary and does not make the player
permanently intangible. - It is intended to help a player escape a
body-block, cross through a crowded fight or avoid being trapped.

**Counterplay and limits** - The effect should not make the player
immune to arena hazards. - The short duration should require deliberate
timing. - The player should remain vulnerable before and after the
effect.

#### 2. METEOR

**Combination:** Jump → Dive\
**Role:** Aerial impact and area displacement.

**Visual effect** - A fiery trail forms around the character during the
dive. - The trail intensifies as the character descends. - On impact, a
bright burst and ground-level shock ring communicate the landing. - The
effect should look powerful without hiding nearby players.

**Gameplay effect** - The dive produces a stronger impact than an
ordinary dive. - Nearby players can be knocked away by the landing
shock. - The impact should reward accurate timing and choosing a useful
landing point.

**Counterplay and limits** - The player commits to a visible downward
trajectory. - Opponents should be able to move away, defend or punish a
missed landing. - The impact should not automatically eliminate everyone
nearby.

#### 3. THUNDERBOLT

**Combination:** Dash → Slide\
**Role:** Fast ground approach and close-range disruption.

**Visual effect** - Electric-blue energy traces the character during the
dash-slide. - Small electrical arcs appear around the body and along the
ground. - A brief blue-white pulse marks the end of the powered slide.

**Gameplay effect** - The slide gains a powerful burst of forward
movement. - Completing the powered slide releases a short-range
shockwave or impact pulse. - The pulse can disrupt nearby opponents and
create space.

**Counterplay and limits** - The movement is committed in its travel
direction. - The shockwave has limited range. - A player who misses the
approach can end up in a poor position.

#### 4. SPIDER

**Combination:** Grapple → Wall Jump\
**Role:** Wall-based movement and rapid redirection.

**Visual effect** - A bright web-like line or energy strand briefly
appears along the grapple path. - The character receives a distinct
visual accent while launching away from the wall. - A sharp visual burst
marks the wall-jump launch.

**Gameplay effect** - When the required grapple and wall-jump conditions
are met, the wall jump receives an enhanced launch. - The player gains a
stronger burst away from the wall, enabling a fast change of direction
or escape. - The effect rewards using the arena geometry rather than
simply pressing movement actions in open space.

**Counterplay and limits** - Requires a valid grapple and wall
interaction. - Its usefulness depends on arena geometry. - It should not
grant a free launch when no valid wall interaction has occurred.

#### 5. COMET

**Combination:** Swing → Dive\
**Role:** Momentum-powered aerial strike.

**Visual effect** - A bright orange or gold trail forms around the
character during the dive. - The trail becomes more intense when the
character enters the dive with greater swing momentum. - A sharp impact
burst marks contact with the arena or another valid impact surface.

**Gameplay effect** - The dive converts swing momentum into a stronger
impact. - The resulting knockback scales with the speed carried into the
dive, within a tuned limit. - It rewards players who build momentum
before committing to the attack.

**Counterplay and limits** - The player must first create a useful
swing. - The dive has a readable trajectory. - A poorly aimed Comet can
leave the player exposed or send them into danger.

#### 6. BULLDOZER

**Combination:** Run → Slide → Dash\
**Role:** Grounded charge and displacement.

**Visual effect** - The character gains a bold, high-contrast impact
aura, using a warm orange or yellow accent. - Dust and speed streaks
trail behind the character. - A brief impact flash appears when the
charge collides with an opponent.

**Gameplay effect** - The sequence produces a powerful forward burst. -
Contact with another player creates increased knockback. - The charge is
intended to break through a crowded ground-level fight or force an
opponent away from a dangerous position.

**Counterplay and limits** - The charge is directional and should be
readable. - It should be possible to evade it or use defensive timing. -
Missing the charge should carry a positional cost.

### 9.6 Mech roster expansion

New Mechs should be added only when they introduce a distinct
interaction or playstyle. Avoid creating multiple Mechs that are simply
different colours of the same knockback effect.

Each new Mech must document: 1. Name and identity. 2. Movement
combination. 3. Activation conditions. 4. Visual effect. 5. Gameplay
effect. 6. Duration and repeat rules. 7. Counterplay. 8. Balance risks.

------------------------------------------------------------------------

## 10. Progression and Unlocks

The confirmed rule is that **all unlocked Mechs are available during a
match**. Players do not select a limited Mech loadout for each match.

The exact unlock economy and progression structure are not yet decided.

Possible progression directions to evaluate: - Unlocking Mechs through
play. - Account-level progression. - Challenges that encourage players
to learn different movement mechanics. - Cosmetic rewards for characters
and Mechs.

Progression should reward continued play without making new players
helpless against experienced players. If Mechs have significant
mechanical effects, unlock requirements and competitive fairness will
need careful testing.

No paid progression, monetisation model, rarity system or specific
unlock currency has been confirmed.

------------------------------------------------------------------------

## 11. Character and Visual Direction

### 11.1 Characters

The selected character direction is **funny, exaggerated ragdoll
characters**.

Characters should have: - Clear silhouettes that are easy to distinguish
during a crowded fight. - Exaggerated body reactions and readable impact
poses. - Strong animation and physics feedback. - Visual personality
without making hitboxes difficult to understand.

The goal is expressive physical comedy without sacrificing competitive
readability.

### 11.2 Visual readability

The game can use bold effects, but important gameplay information must
remain visible.

-   Mech activation should be immediately recognisable.
-   Players should remain distinguishable during large effects.
-   Hazards should have clear visual language.
-   Attack and defensive states should be readable.
-   Effects should not obscure ledges, grapple points or incoming
    threats.

### 11.3 Audio direction

Audio should reinforce the physical nature of the game: - Clear, punchy
collision sounds. - Distinct grapple attachment and release sounds. -
Readable attack and defence feedback. - Unique activation cues for each
Mech. - Strong but brief elimination and hazard sounds.

Specific music, voice lines and sound assets are not yet defined.

------------------------------------------------------------------------

## 12. Multiplayer and Technical Direction

### 12.1 Intended architecture

The proposed development direction is: - **Engine:** Godot 4. -
**Scripting:** GDScript. - **Presentation:** 3D characters and
environments. - **Gameplay plane:** 2D-constrained movement for a 2.5D
side-view game. - **Development sequence:** Build and test a local
playable prototype before attempting full online multiplayer.

These are the current technical proposals, not proof that the
architecture has already been implemented.

### 12.2 Multiplayer physics

Online physics multiplayer is a significant technical challenge. The
game will need consistent simulation and authoritative decisions so that
players do not see conflicting collisions, grapple states, knockback or
eliminations.

The intended direction is an authoritative server model for important
match simulation and outcomes. The precise networking model, tick rate,
interpolation, prediction and reconciliation strategy must be chosen and
tested during implementation.

### 12.3 Prototype before online scale

The first prototype should prove that the game is fun before networking
complexity is introduced.

Recommended prototype order: 1. One controllable character in a simple
test arena. 2. Run, jump, double jump, dash and slide. 3. Grapple,
swing, pull and release behaviour. 4. Wall jump, ledge grab and dive. 5.
Player collision, attack and defend. 6. One arena hazard and a basic
elimination condition. 7. Local multi-character testing. 8. A small
selection of Mechs. 9. Online multiplayer prototype. 10. Additional
arenas, modes, progression and polish.

This sequence is a development recommendation, not a promise that online
multiplayer will be simple.

------------------------------------------------------------------------

## 13. User Interface and Match Information

The interface should be minimal during a match so the action remains
visible.

Potential in-match information: - Player identity and status. -
Remaining players. - Match timer, if used. - Clear elimination
feedback. - Brief Mech activation feedback.

The exact HUD, lobby, matchmaking, results screen, settings and
progression menus are not yet designed.

------------------------------------------------------------------------

## 14. Replayability and Shareable Moments

The game is intended to produce entertaining gameplay naturally. The
core design should be the source of shareable moments, rather than
relying on a separate social feature to make the game interesting.

Design priorities: - Short rounds with frequent player interaction. -
Distinct arenas that create different movement opportunities. - A
readable chain of cause and effect during spectacular moments. -
High-skill movement that is impressive to watch. - Funny physical
reactions and unexpected recoveries. - Strong final-player encounters.

Automatic replay capture, clip export, spectator tools, leaderboards and
social sharing are possible future features, but are not confirmed core
requirements.

------------------------------------------------------------------------

## 15. Design Boundaries

These constraints protect the current direction.

-   Do not turn the game into a conventional weapon-based shooter.
-   Do not add fundamental movement mechanics beyond the defined
    movement kit without a deliberate design decision.
-   Do not reintroduce Air Recovery.
-   Pull is only available while grappling.
-   Ledge Grab is only possible within a defined distance of a valid
    ledge.
-   Grapple targets include surfaces and other players.
-   Mechs use no more than three movement mechanics.
-   Mechs activate automatically when their combinations are performed
    correctly.
-   All unlocked Mechs are available during a match.
-   Mechs have both visual and gameplay effects.
-   Attack and Defend are fundamental actions, but are not currently
    Mech components.
-   Player-discovered Tech is not a focus of this document. If the
    underlying game is good, emergent techniques should arise naturally
    from the mechanics and physics. No separate Tech system is required
    for the current design scope.

------------------------------------------------------------------------

## 16. Confirmed Decisions vs. Open Questions

### Confirmed

-   Multiplayer physics arena brawler.
-   2.5D presentation with a side-view camera.
-   4--8 players per match.
-   Funny, exaggerated ragdoll characters.
-   A mixture of chaotic fun and competitive skill.
-   Highly interactive and destructible arena direction.
-   Main mode is last player standing.
-   Main elimination method is knocking opponents out of the arena or
    into hazards.
-   The defined movement kit: Run, Jump, Double Jump, Dash, Slide, Wall
    Jump, Grapple, Swing, Pull, Ledge Grab and Dive.
-   Pull only works while grappling.
-   Ledge Grab only works within a certain distance of a ledge.
-   Air Recovery is removed.
-   Attack and Defend are the only additional fundamental actions.
-   Grapple can attach to surfaces and players.
-   All unlocked Mechs are available during a match.
-   Mechs activate automatically when their combinations are performed
    correctly.
-   Mechs have visual and mechanical effects.
-   Each Mech uses up to three movement mechanics.
-   Player-discovered Tech is not a current design priority.

### Open questions

-   Final game title.
-   Exact attack and defend behaviour.
-   Exact grapple range, resistance, duration and break rules.
-   Exact ledge-grab distance and whether it is automatic or
    input-triggered.
-   Mech trigger windows and whether order matters for each combination.
-   Mech repeat-activation/cooldown rules.
-   Final Mech roster, names, effects and balance.
-   Mech unlock progression.
-   Final arena layouts, hazards and destruction behaviour.
-   Exact rules for additional modes.
-   HUD, lobby, matchmaking and results screens.
-   Online networking implementation and server architecture details.
-   Monetisation and post-launch content plans.

------------------------------------------------------------------------

## 17. First Playable Milestone

The first milestone is not a complete online game. It is a small
prototype that proves the core movement and combat are fun.

**Prototype contents** - One test arena with a platform, walls, ledges
and a lethal boundary. - One ragdoll character controller. - Run, Jump,
Double Jump, Dash, Slide, Wall Jump, Grapple, Swing, Pull, Ledge Grab
and Dive. - Basic Attack and Defend. - Player collision and knockback. -
A simple last-player-standing elimination test with local test
characters or a suitable local multiplayer setup. - One or two prototype
Mechs, initially Phantom and Meteor, to validate automatic combination
recognition and visual/mechanical effects.

**Success criteria** - Movement feels responsive and controllable. -
Momentum creates useful opportunities rather than random loss of
control. - Grappling is fun and creates meaningful routes and
interactions. - Players can understand why they were hit or
eliminated. - A small fight creates surprising moments without becoming
unreadable. - Mechs are recognisable, satisfying and do not overwhelm
ordinary movement.

Once these criteria are met, expand the arena, Mech roster and
multiplayer implementation.

------------------------------------------------------------------------

## 18. Document Maintenance

This file is the current consolidated design reference.

When updating it: - Preserve confirmed decisions unless the user
explicitly changes them. - Mark new ideas as proposals until approved. -
Move rejected ideas out of the active design. - Update the Confirmed
Decisions and Open Questions sections whenever a design decision is
made. - Keep implementation details separate from gameplay rules. - Do
not silently convert examples into confirmed features.
