import { version } from '../package.json';

export const PRODUCT_VERSION = version;
export const PRODUCT_VERSION_LABEL = `V${version.split('.')[0]}`;
export const PRODUCT_NAME = `SilverSky ${PRODUCT_VERSION_LABEL}`;
