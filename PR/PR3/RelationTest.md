# PR3 Relation Tests

| ID | Event Chain | Expected | Test |
| --- | --- | --- | --- |
| RT01 | LinkCore → EDPMU.Language | 1 shared locale | language.test.js |
| RT02 | UI → Hub → LanguageManager.set(en) | 200 Log | language.test.js |
| RT03 | UI → Hub → LanguageManager.set(xx) | 400 EHU | language.test.js |
| RT04 | Agent → Hub → LanguageManager.set(en) | 403 EHU | language.test.js |
| RT05 | Agent → Hub → LanguageManager.translate | 200 | language.test.js |
| RT06 | storage → LanguageManager.restore → EDPMU | PASS | language.test.js |
| RT07 | storage unavailable → memory + EHU | 503 EHU | language.test.js |
| RT08 | Language → DocumentStatus translation | PASS | language.test.js |
| RT09 | old UI language dropdown → English strings | PASS | editor.spec.js |
| RT10 | switch → reload → Chinese restore | PASS | editor.spec.js |
| RT11 | unsaved file → language toggle → unchanged bytes | PASS | editor.spec.js |

CI PASS/FAIL must be confirmed on latest PR head, not assumed from
source code or earlier runs.
