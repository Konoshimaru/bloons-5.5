import js from '@eslint/js';

const coreFiles = [
    'js/fixedStepClock.js',
    'js/collisionGeometry.js',
    'js/savedRunValidation.js',
    'js/engineComposition.js',
    'js/towerFactory.js',
    'js/damageTypes.js',
    'js/statusEffects.js',
    'js/spatialGrid.js',
    'js/webgl/renderFailurePolicy.js',
    'tests/fixedStepClock.test.js',
    'tests/collisionGeometry.test.js',
    'tests/savedRunValidation.test.js',
    'tests/engineComposition.test.js',
    'tests/towerFactory.test.js',
    'tests/renderFailurePolicy.test.js',
    'tests/projectileCollisionBroadphase.test.js'
];

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'js/backups/**',
            'scripts/**'
        ]
    },
    {
        files: coreFiles,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                describe: 'readonly',
                expect: 'readonly',
                it: 'readonly',
                vi: 'readonly',
                structuredClone: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules
        }
    }
];
