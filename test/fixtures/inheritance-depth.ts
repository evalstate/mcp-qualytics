// Interface hierarchy
interface Entity {
    id: string;
}

interface Named extends Entity {
    name: string;
}

interface Movable extends Named {
    move(): void;
}

// Deep class inheritance chain
abstract class Vehicle implements Movable {
    constructor(public id: string, public name: string) {}
    abstract move(): void;
}

class LandVehicle extends Vehicle {
    constructor(id: string, name: string, protected wheels: number) {
        super(id, name);
    }

    move(): void {
        console.log("Moving on land");
    }
}

class Car extends LandVehicle {
    constructor(id: string, name: string) {
        super(id, name, 4);
    }
}

class RaceCar extends Car {
    constructor(id: string, name: string, private maxSpeed: number) {
        super(id, name);
    }
}

class F1Car extends RaceCar {
    constructor(id: string, name: string) {
        super(id, name, 350);
    }
}

// Multiple interface inheritance
interface Drawable {
    draw(): void;
}

interface Scalable {
    scale(factor: number): void;
}

interface RenderableShape extends Drawable, Scalable {
    getArea(): number;
}

// Class implementing multiple interfaces
class Shape implements RenderableShape {
    constructor(protected width: number, protected height: number) {}

    draw(): void {
        console.log("Drawing shape");
    }

    scale(factor: number): void {
        this.width *= factor;
        this.height *= factor;
    }

    getArea(): number {
        return this.width * this.height;
    }
}

// Mixin pattern
type Constructor<T = {}> = new (...args: any[]) => T;

function TimestampMixin<TBase extends Constructor>(Base: TBase) {
    return class extends Base {
        timestamp: Date = new Date();
        
        getTimestamp(): Date {
            return this.timestamp;
        }
    };
}

function VersionMixin<TBase extends Constructor>(Base: TBase) {
    return class extends Base {
        version: number = 1;
        
        incrementVersion(): void {
            this.version++;
        }
    };
}

// Class using mixins
class Rectangle extends TimestampMixin(VersionMixin(Shape)) {
    constructor(width: number, height: number) {
        super(width, height);
    }
}

