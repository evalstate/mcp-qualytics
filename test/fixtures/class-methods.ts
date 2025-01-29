class TestClass {
    constructor(private name: string) {}

    public simpleMethod(): void {
        console.log("Hello");
    }

    private complexMethod(): number {
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) {
                sum += i;
            } else if (i % 3 === 0) {
                sum += i * 2;
            } else {
                sum += 1;
            }
        }
        return sum;
    }

    public methodWithArrow(): void {
        const handler = () => {
            console.log(this.name);
        };
        handler();
    }
}