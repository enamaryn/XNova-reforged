export interface BuildingCost {
    metal: number;
    crystal: number;
    deuterium: number;
    energy?: number;
}
export interface Building {
    id: number;
    name: string;
    description: string;
    baseCost: BuildingCost;
    factor: number;
    category: 'resource' | 'facility' | 'station' | 'defense' | 'moon';
    requirements?: Record<string, number>;
}
export declare const BUILDINGS: Record<number, Building>;
export declare function getBuildingCost(buildingId: number, currentLevel: number): BuildingCost;
export declare function getDemolitionRefund(buildingId: number, currentLevel: number): BuildingCost;
export interface BuildTimeParams {
    buildingId: number;
    currentLevel: number;
    roboticsLevel: number;
    naniteLevel?: number;
    engineerLevel?: number;
}
export declare function getBuildingTime(params: BuildTimeParams): number;
export declare function checkBuildingRequirements(buildingId: number, planetBuildings: Record<string, number>, userTechnologies?: Record<string, number>): {
    canBuild: boolean;
    missingRequirements: string[];
};
