import { CompileSpec } from '../../model/cocos-world';
export interface ValidationError {
    error: string;
    errorCode: string;
}
export declare function validate(spec: CompileSpec): ValidationError | null;
//# sourceMappingURL=validate.d.ts.map