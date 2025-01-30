// Simple linear inheritance chain
class BaseClass {
    constructor(protected name: string) {}
    
    getName(): string {
        return this.name;
    }
}

class Level1 extends BaseClass {
    getNameUpper(): string {
        return this.name.toUpperCase();
    }
}

class Level2 extends Level1 {
    getNameLower(): string {
        return this.name.toLowerCase();
    }
}

class Level3 extends Level2 {
    getNameLength(): number {
        return this.name.length;
    }
}

// Export to ensure TypeScript processes this as a module
export { BaseClass, Level1, Level2, Level3 };