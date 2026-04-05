# Kraflow Canvas: Professional Roadmap

This document outlines the step-by-step plan to transform this base canvas library into a professional design tool for React Native app development.

## Phase 1: Core Layout & Style (The RN Foundation)

- [ ] **Step 1: Advanced Styles**: Implement drop shadows (mapping to iOS `shadowOffset` and Android `elevation`), linear gradients, and specific corner radius control.
- [ ] **Step 2: "Hug" & "Fill" Logic**: Add high-level abstractions for Yoga's auto-sizing. Critical for making layouts behave like real React Native components.
- [ ] **Step 3: Safe Area & Status Bars**: Add built-in overlays for mobile device furniture (notches, status bars) to account for real-world screen constraints.

## Phase 2: Professional Interaction & Precision

- [ ] **Step 4: Smart Guides & Snapping**: Implement visual guides that appear when dragging to align with siblings or maintain standard 8px/16px gutters.
- [ ] **Step 5: Distance Measuring**: Show pixel distances between the selected node and other nodes when holding `Alt/Option`.
- [ ] **Step 6: Multi-Selection Actions**: Implement alignment (Align Left, Center, etc.) and distribution (Space Evenly) for multiple selected nodes.

## Phase 3: The Component System (Reusability)

- [ ] **Step 7: Master Components & Instances**: Create the ability to define a "Master" node and spawn "Instances" that stay in sync.
- [ ] **Step 8: Property Overrides**: Allow instances to have unique text or images while keeping the master's layout and parent styles.
- [ ] **Step 9: Shared Styles**: Implement global "Color Variables" and "Text Styles" so updating one color updates the whole app.

## Phase 4: The React Native Bridge (Code Export)

- [ ] **Step 10: StyleSheet Serialization**: Build a service that converts internal node styles into a clean, optimized React Native `StyleSheet.create` object.
- [ ] **Step 11: JSX Generation**: Recursively map the SceneGraph tree into a human-readable JSX structure (`<View>`, `<Text>`, `<Image>`).
- [ ] **Step 12: Platform-Specific Switches**: Add UI toggles to preview and override styles specifically for iOS or Android within the same design.

## Phase 5: Production & Workflow

- [ ] **Step 13: Undo/Redo System**: Implement a robust history manager for every interaction on the canvas.
- [ ] **Step 14: Project Persistence**: Move beyond single-screen serialization to full multi-screen project saving/loading.
