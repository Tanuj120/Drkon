import { randomInt } from 'node:crypto';

const randomInteger = (minimum, maximum) => {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
        throw new Error('Invalid random integer range');
    }
    return randomInt(minimum, maximum + 1);
};

const randomDigitString = (length, minimum = 0, maximum = 9) => {
    if (!Number.isInteger(length) || length <= 0) throw new Error('Invalid random digit length');
    return Array.from({ length }, () => randomInteger(minimum, maximum)).join('');
};

export { randomInteger, randomDigitString };
