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
    'js/mapEditorHistory.js',
    'js/uiWriteThrottle.js',
    'js/mapEditorValidation.js',
    'js/mapEditorIO.js',
    'js/webgl/renderFailurePolicy.js',
    'tests/fixedStepClock.test.js',
    'tests/collisionGeometry.test.js',
    'tests/savedRunValidation.test.js',
    'tests/engineComposition.test.js',
    'tests/towerFactory.test.js',
    'tests/renderFailurePolicy.test.js',
    'tests/projectileCollisionBroadphase.test.js',
    'tests/mapEditorHistory.test.js',
    'tests/v143fixes.test.js',
    'tests/mapEditorValidation.test.js',
    'tests/mapEditorIOValidation.test.js'
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
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                describe: 'readonly',
                alert: 'readonly',
                document: 'readonly',
                expect: 'readonly',
                FileReader: 'readonly',
                it: 'readonly',
                Image: 'readonly',
                performance: 'readonly',
                vi: 'readonly',
                structuredClone: 'readonly',
                crypto: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                test: 'readonly',
                prompt: 'readonly',
                window: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules
        }
    }
];
