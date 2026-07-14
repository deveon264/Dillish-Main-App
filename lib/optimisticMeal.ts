import type { CalorieLog } from "@/lib/notifications";

type MealEntry = Omit<CalorieLog, "id" | "ts">;

type OptimisticMealOptions = {
  entry: MealEntry;
  stockPhotoUrl?: string | null;
  addCalorie: (entry: MealEntry) => Promise<string>;
  updateCaloriePhoto: (id: string, uri: string) => Promise<void>;
  rehostPhoto: (url: string) => Promise<string>;
};

// Commits the meal to device storage before any stock-photo network request is
// started. The stock URL is useful immediately; re-hosting merely upgrades it
// to a durable app URL in the background and is always failure-contained.
export async function addMealWithBackgroundPhoto({
  entry,
  stockPhotoUrl,
  addCalorie,
  updateCaloriePhoto,
  rehostPhoto,
}: OptimisticMealOptions): Promise<string> {
  const temporaryPhotoUri = entry.photoUri ?? stockPhotoUrl ?? undefined;
  const entryId = await addCalorie({ ...entry, photoUri: temporaryPhotoUri });

  if (stockPhotoUrl && !entry.photoUri) {
    try {
      void rehostPhoto(stockPhotoUrl)
        .then((durableUri) => {
          if (durableUri !== stockPhotoUrl) {
            return updateCaloriePhoto(entryId, durableUri);
          }
        })
        .catch(() => {
          // The temporary URL remains on the entry. Background photo work must
          // never interrupt or undo an otherwise successful local meal log.
        });
    } catch {
      // Also contain a backend that throws before returning its promise.
    }
  }

  return entryId;
}
