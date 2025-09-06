export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  addedAt: number;
}

export interface RecipeIdea {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  missing?: string[];
}
