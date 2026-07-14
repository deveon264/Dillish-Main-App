import { test } from "node:test";
import assert from "node:assert/strict";
import { addMealWithBackgroundPhoto } from "@/lib/optimisticMeal";

const entry = {
  name: "Berry oats",
  kcal: 420,
  protein: 18,
  carbs: 62,
  fats: 10,
  mealType: "Breakfast",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("meal entry is added with the temporary URL before re-hosting starts", async () => {
  const localWrite = deferred<string>();
  const events: string[] = [];
  const run = addMealWithBackgroundPhoto({
    entry,
    stockPhotoUrl: "https://stock/photo.jpg",
    addCalorie: async (value) => {
      events.push(`add:${value.photoUri}`);
      return localWrite.promise;
    },
    updateCaloriePhoto: async () => { events.push("update"); },
    rehostPhoto: async () => {
      events.push("rehost");
      return "file:///durable.jpg";
    },
  });

  assert.deepEqual(events, ["add:https://stock/photo.jpg"]);
  localWrite.resolve("meal-7");
  assert.equal(await run, "meal-7");
  await flush();
  assert.deepEqual(events, ["add:https://stock/photo.jpg", "rehost", "update"]);
});

test("local meal failure prevents network work and preserves the rejection", async () => {
  let rehostCalls = 0;
  await assert.rejects(
    addMealWithBackgroundPhoto({
      entry,
      stockPhotoUrl: "https://stock/photo.jpg",
      addCalorie: async () => { throw new Error("disk full"); },
      updateCaloriePhoto: async () => {},
      rehostPhoto: async () => {
        rehostCalls += 1;
        return "file:///durable.jpg";
      },
    }),
    /disk full/,
  );
  assert.equal(rehostCalls, 0);
});

test("background photo failures are contained and keep the temporary URL", async () => {
  let updateCalls = 0;
  const id = await addMealWithBackgroundPhoto({
    entry,
    stockPhotoUrl: "https://stock/photo.jpg",
    addCalorie: async () => "meal-8",
    updateCaloriePhoto: async () => { updateCalls += 1; },
    rehostPhoto: async () => { throw new Error("offline"); },
  });
  await flush();
  assert.equal(id, "meal-8");
  assert.equal(updateCalls, 0);
});

test("device photos skip re-hosting and background updates target the created ID", async () => {
  let rehostCalls = 0;
  const updates: Array<[string, string]> = [];
  await addMealWithBackgroundPhoto({
    entry: { ...entry, photoUri: "file:///device.jpg" },
    stockPhotoUrl: "https://stock/ignored.jpg",
    addCalorie: async () => "device-meal",
    updateCaloriePhoto: async (id, uri) => { updates.push([id, uri]); },
    rehostPhoto: async () => {
      rehostCalls += 1;
      return "file:///durable.jpg";
    },
  });
  assert.equal(rehostCalls, 0);
  assert.equal(updates.length, 0);

  await addMealWithBackgroundPhoto({
    entry,
    stockPhotoUrl: "https://stock/photo.jpg",
    addCalorie: async () => "stock-meal",
    updateCaloriePhoto: async (id, uri) => { updates.push([id, uri]); },
    rehostPhoto: async () => "file:///durable.jpg",
  });
  await flush();
  assert.deepEqual(updates, [["stock-meal", "file:///durable.jpg"]]);
});
