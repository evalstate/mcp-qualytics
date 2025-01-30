// Deep interface inheritance chain
interface BaseInterface {
    id: string;
}

interface Level1 extends BaseInterface {
    name: string;
}

interface Level2 extends Level1 {
    description: string;
}

interface Level3 extends Level2 {
    type: string;
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

interface D extends C {
    methodD(): void;
}

// Class implementing deep interface
class DeepImplementation implements Level3 {
    id: string = "1";
    name: string = "test";
    description: string = "desc";
    type: string = "type";
}

// Class extending and implementing
class Base {
    constructor(protected value: string) {}
}

class Extended extends Base implements D {
    constructor(value: string) {
        super(value);
    }
    
    methodA(): void {}
    methodB(): void {}
    methodC(): void {}
    methodD(): void {}
}

// Abstract class chain with interface
abstract class AbstractBase implements A {
    abstract methodA(): void;
}

abstract class AbstractMid extends AbstractBase implements B {
    abstract methodB(): void;
}

class Concrete extends AbstractMid implements C {
    methodA(): void {}
    methodB(): void {}
    methodC(): void {}
}

// Export to ensure TypeScript processes this as a module
export {
    BaseInterface, Level1, Level2, Level3,
    A, B, C, D,
    DeepImplementation, Base, Extended,
    AbstractBase, AbstractMid, Concrete
};