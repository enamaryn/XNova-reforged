export interface TechCost {
    metal: number;
    crystal: number;
    deuterium: number;
    energy?: number;
}
export interface Technology {
    id: number;
    name: string;
    description: string;
    baseCost: TechCost;
    factor: number;
    category: 'basic' | 'drive' | 'advanced' | 'combat';
    requirements?: Record<string, number>;
}
export declare const TECHNOLOGIES: Record<number, Technology>;
export declare function getTechnologyCost(techId: number, currentLevel: number): TechCost;
