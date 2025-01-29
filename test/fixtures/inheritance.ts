interface Animal {
    name: string;
    makeSound(): void;
}

class BaseAnimal {
    constructor(protected name: string) {}
    
    protected getSpecies(): string {
        return "Unknown";
    }
}

class Dog extends BaseAnimal implements Animal {
    constructor(name: string) {
        super(name);
    }

    public makeSound(): void {
        console.log("Woof!");
    }

    protected getSpecies(): string {
        return "Canis lupus";
    }
}

class Cat extends BaseAnimal implements Animal {
    private lives: number = 9;

    constructor(name: string) {
        super(name);
    }

    public makeSound(): void {
        console.log("Meow!");
    }

    protected getSpecies(): string {
        return "Felis catus";
    }

    public decrementLife(): void {
        if (this.lives > 0) {
            this.lives--;
        }
    }
}