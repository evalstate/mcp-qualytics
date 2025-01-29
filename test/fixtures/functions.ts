// Named function
function greet(name: string): string {
    return `Hello ${name}`;
}

// Arrow function assigned to variable
const multiply = (a: number, b: number): number => a * b;

// Function with complex logic
function processArray(items: number[]): number[] {
    const result: number[] = [];
    
    items.forEach((item) => {
        if (item > 0) {
            result.push(item * 2);
        } else {
            result.push(0);
        }
    });

    return result.sort((a, b) => a - b);
}

// IIFE with async/await
(async function() {
    try {
        await Promise.resolve();
        console.log("Done");
    } catch (error) {
        console.error(error);
    }
})();