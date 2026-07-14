import { test } from "node:test";
import assert from "node:assert/strict";

import { foodBarcodePost } from "@/app/api/food-barcode+api";

function postReq(body: unknown): Request {
  return new Request("http://t/api/food-barcode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

test("barcode lookup maps serving nutrition into the meal result shape", async () => {
  let requestedUrl = "";
  let userAgent = "";
  const res = await foodBarcodePost(postReq({ barcode: "5449000000996" }), {
    async fetchProduct(url, init) {
      requestedUrl = url;
      userAgent = String((init?.headers as Record<string, string>)?.["User-Agent"] ?? "");
      return jsonResponse({
        status: 1,
        product: {
          product_name: "Protein Yogurt",
          image_front_url: "https://images.openfoodfacts.org/yogurt.jpg",
          nutriments: {
            "energy-kcal_serving": 150,
            proteins_serving: 20,
            carbohydrates_serving: 10,
            fat_serving: 3,
            "energy-kcal_100g": 90,
            proteins_100g: 12,
            carbohydrates_100g: 5,
            fat_100g: 1,
          },
        },
      });
    },
  });

  assert.equal(res.status, 200);
  assert.match(requestedUrl, /5449000000996/);
  assert.match(userAgent, /FlorishFitness/);
  assert.deepEqual(await res.json(), {
    name: "Protein Yogurt",
    kcal: 150,
    protein: 20,
    carbs: 10,
    fats: 3,
    photoUrl: "https://images.openfoodfacts.org/yogurt.jpg",
  });
});

test("barcode lookup falls back to 100g nutrition", async () => {
  const res = await foodBarcodePost(postReq({ barcode: "1234567890123" }), {
    async fetchProduct() {
      return jsonResponse({
        status: 1,
        product: {
          product_name: "Cereal",
          nutriments: {
            "energy-kcal_100g": 380,
            proteins_100g: 8,
            carbohydrates_100g: 74,
            fat_100g: 5,
          },
        },
      });
    },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    name: "Cereal",
    kcal: 380,
    protein: 8,
    carbs: 74,
    fats: 5,
  });
});

test("barcode lookup requires a barcode", async () => {
  const res = await foodBarcodePost(postReq({}));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Scan a barcode first." });
});

test("barcode lookup returns 404 when the product is not found", async () => {
  const res = await foodBarcodePost(postReq({ barcode: "1234567890123" }), {
    async fetchProduct() {
      return jsonResponse({ status: 0 });
    },
  });

  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Product not found for that barcode." });
});

test("barcode lookup reports unavailable nutrition", async () => {
  const res = await foodBarcodePost(postReq({ barcode: "1234567890123" }), {
    async fetchProduct() {
      return jsonResponse({
        status: 1,
        product: {
          product_name: "Mystery snack",
          nutriments: {},
        },
      });
    },
  });

  assert.equal(res.status, 422);
  assert.deepEqual(await res.json(), { error: "Nutrition is unavailable for that product." });
});
