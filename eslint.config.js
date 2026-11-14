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
    'js/mapEditorState.js',
    'js/mapRenderCore.js',
    'js/mapEditorRenderer.js',
    'js/mapEditorInput.js',
    'js/mapEditor.js',
    'js/cutsceneRuntime.js',
    'js/mapMeta.js',
    'js/names.js',
    'js/projectileTypeConfig.js',
    'js/projectileHitResolution.js',
    'js/loadGate.js',
    'js/map.js',
    'js/enemy.js',
    'js/enemyDamage.js',
    'js/pool.js',
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
    'tests/mapEditorIOValidation.test.js',
    'tests/mapEditorState.test.js',
    'tests/mapRenderCore.test.js',
    'tests/mapEditorRenderer.test.js',
    'tests/mapEditorInput.test.js',
    'tests/mapEditorComposition.test.js',
    'tests/cutsceneRuntime.test.js',
    'tests/mapMeta.test.js',
    'tests/names.test.js',
    'tests/projectileTypeConfig.test.js',
    'tests/projectileHitResolution.test.js',
    'tests/loadGate.test.js',
    'tests/gameMapPathGeometry.test.js',
    'tests/v133audit.test.js',
    'tests/damage.test.js',
    'tests/pool.test.js'
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
                cancelAnimationFrame: 'readonly',
                confirm: 'readonly',
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
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                test: 'readonly',
                prompt: 'readonly',
                requestAnimationFrame: 'readonly',
                window: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules
        }
    }
];
