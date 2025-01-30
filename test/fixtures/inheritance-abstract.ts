// Abstract class inheritance
abstract class AbstractBase {
    constructor(protected id: string) {}
    abstract process(): void;
}

abstract class AbstractLevel1 extends AbstractBase {
    constructor(id: string, protected name: string) {
        super(id);
    }
    abstract validate(): boolean;
}

class ConcreteClass extends AbstractLevel1 {
    process(): void {
        console.log(`Processing ${this.name}`);
    }
    
    validate(): boolean {
        return this.name.length > 0;
    }
}

// Interface + Abstract class combination
interface Identifiable {
    getId(): string;
}

interface Nameable {
    getName(): string;
}

abstract class AbstractWithInterface implements Identifiable {
    constructor(protected id: string) {}
    
    getId(): string {
        return this.id;
    }
    
    abstract process(): void;
}

class ConcreteWithInterfaces extends AbstractWithInterface implements Nameable {
    constructor(id: string, private name: string) {
        super(id);
    }
    
    getName(): string {
        return this.name;
    }
    
    process(): void {
        console.log(`Processing ${this.name}`);
    }
}

// Export to ensure TypeScript processes this as a module
export {
    AbstractBase, AbstractLevel1, ConcreteClass,
    Identifiable, Nameable, AbstractWithInterface, ConcreteWithInterfaces
};