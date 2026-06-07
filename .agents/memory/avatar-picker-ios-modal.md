---
name: iOS image-picker after RN Modal
description: Why expo-image-picker silently does nothing when launched right after closing a React Native <Modal> on iOS, and the deterministic fix.
---

# expo-image-picker won't open after a RN <Modal> closes (iOS)

On iOS, a React Native `<Modal>` is its own native view controller. If you call
`ImagePicker.launchImageLibraryAsync` / `launchCameraAsync` in the same tick you
set the Modal `visible={false}` (or after only a timer / `InteractionManager`
delay), iOS tries to present the picker's VC on a VC that is still mid-dismiss and
**silently refuses** — no picker, no error, no log. The user just sees "nothing
happens."

**Why timers don't fix it:** `setTimeout` and `InteractionManager.runAfterInteractions`
resolve on the JS interaction queue, which is NOT the same as the native modal
dismiss completing. They frequently fire too early. (This bug was "fixed" twice with
timing hacks before the real fix landed.)

**Deterministic fix:** launch the picker from the Modal's `onDismiss` prop, which on
iOS fires only AFTER the native modal VC is fully gone. Pattern:
- Sheet option handler records the chosen action in a ref (e.g. `pendingPickRef`),
  sets the picker-busy guard, and closes the modal — it does NOT launch the picker.
- `<Modal onDismiss={...}>` reads + clears the ref and launches the picker.
- `onDismiss` is **iOS-only**; on Android/web it never fires, so for those platforms
  launch from the trigger after the usual `InteractionManager`/timeout wait. Branch
  on `Platform.OS === "ios"`.
- Backdrop/Cancel/Remove close the modal with the ref null, so `onDismiss` no-ops.

**How to apply:** any time a native action sheet built on RN `<Modal>` must open a
camera/library/share/other system VC, defer the launch to `onDismiss` (iOS) instead
of guessing with a delay. Same applies to other present-a-VC APIs (e.g. share sheets).
