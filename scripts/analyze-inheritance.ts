import { Project, ClassDeclaration, InterfaceDeclaration } from "ts-morph";

function getClassInheritanceDepth(classDec: ClassDeclaration): number {
    let depth = 0;
    let currentClass = classDec;

    while (currentClass.getBaseClass()) {
        depth++;
        currentClass = currentClass.getBaseClass()!;
    }

    // Add interface implementation depth
    const maxInterfaceDepth = classDec.getImplements().reduce((max, impl) => {
        const depth = getInterfaceInheritanceDepth(impl.getType().getSymbol()?.getDeclarations()[0] as InterfaceDeclaration);
        return Math.max(max, depth);
    }, 0);

    return depth + maxInterfaceDepth;
}

function getInterfaceInheritanceDepth(interfaceDec?: InterfaceDeclaration): number {
    if (!interfaceDec) return 0;
    
    const baseInterfaces = interfaceDec.getBaseDeclarations();
    if (baseInterfaces.length === 0) return 0;

    const depths = baseInterfaces.map(base => {
        if (base instanceof InterfaceDeclaration) {
            return 1 + getInterfaceInheritanceDepth(base);
        }
        return 0;
    });

    return Math.max(...depths);
}

const project = new Project();

// Add the test files
project.addSourceFilesAtPaths([
    "test/fixtures/inheritance-linear.ts",
    "test/fixtures/inheritance-interfaces.ts",
    "test/fixtures/inheritance-abstract.ts"
]);

// Analyze each source file
for (const sourceFile of project.getSourceFiles()) {
    console.log(`\nAnalyzing ${sourceFile.getFilePath()}:`);
    
    // Analyze classes
    const classes = sourceFile.getClasses();
    console.log("\nClasses:");
    classes.forEach(cls => {
        const depth = getClassInheritanceDepth(cls);
        console.log(`${cls.getName()}: Inheritance depth = ${depth}`);
    });

    // Analyze interfaces
    const interfaces = sourceFile.getInterfaces();
    console.log("\nInterfaces:");
    interfaces.forEach(iface => {
        const depth = getInterfaceInheritanceDepth(iface);
        console.log(`${iface.getName()}: Inheritance depth = ${depth}`);
    });
}