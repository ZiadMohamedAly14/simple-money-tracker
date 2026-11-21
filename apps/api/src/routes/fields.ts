import { body } from 'express-validator';
import { SIGN_IN_CODE_LENGTH, SUPPORTED_LANGUAGES, isValidParentPin } from '@money-tracker/shared';

/** Request-body validators shared by the routes, so every route checks a PIN, code or language the same way. */

const CODE_PATTERN = new RegExp(`^\\d{${SIGN_IN_CODE_LENGTH}}$`);

/** A Parent PIN: 4 to 6 Western digits. */
export const pinField = (field = 'pin') =>
  body(field).custom((value) => isValidParentPin(value)).withMessage('The PIN is 4 to 6 digits');

/** An emailed one-time code: 6 digits. */
export const codeField = (field = 'code') =>
  body(field).isString().matches(CODE_PATTERN).withMessage(`The code is ${SIGN_IN_CODE_LENGTH} digits`);

/** The language an email is written in; English when not given. */
export const languageField = (field = 'language') => body(field).default('en').isIn([...SUPPORTED_LANGUAGES]);
