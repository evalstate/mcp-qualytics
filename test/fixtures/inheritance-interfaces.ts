// Interface inheritance patterns
interface Base {
    id: string;
}

interface Level1Interface extends Base {
    name: string;
}

interface Level2Interface extends Level1Interface {
    description: string;
}

// Class implementing deep interface chain
class Implementation implements Level2Interface {
    constructor(
        public id: string,
        public name: string,
        public description: string
    ) {}
}

// Multiple interface inheritance
interface A {
    methodA(): void;
}

interface B {
    methodB(): void;
}

interface C extends A, B {
    methodC(): void;
}

class MultiImplementation implements C {
    methodA(): void {}
    methodB(): void {}
    methodC(): void {}
}

// Export to ensure TypeScript processes this as a module
export { 
    Base, Level1Interface, Level2Interface, Implementation,
    A, B, C, MultiImplementation 
};