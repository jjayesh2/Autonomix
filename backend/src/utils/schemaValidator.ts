import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function validateSchema(schema: any, data: any): { isValid: boolean; errors: string[] } {
  try {
    if (!schema || Object.keys(schema).length === 0) {
      return { isValid: true, errors: [] };
    }

    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid && validate.errors) {
      const errorMessages = validate.errors.map(
        (err) => `${err.instancePath || 'root'} ${err.message}`
      );
      return { isValid: false, errors: errorMessages };
    }

    return { isValid: true, errors: [] };
  } catch (err: any) {
    return { isValid: false, errors: [`Schema compilation error: ${err?.message}`] };
  }
}
