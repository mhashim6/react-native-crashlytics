import { NativeModules } from 'react-native';
const { RnCrashlytics } = NativeModules;

import StackTrace from 'stacktrace-js';

function isError(value) {
    if (Object.prototype.toString.call(value) === '[object Error]') {
        return true;
    }
    return value instanceof Error;
}

function createNativeErrorObj(error, stackFrames, forceFatal) {
    const nativeObj = {};

    nativeObj.message = `${error.message}`;
    nativeObj.forceFatal = forceFatal;

    nativeObj.frames = [];
    for (let i = 0; i < stackFrames.length; i++) {
        const { columnNumber, lineNumber, fileName, functionName, source } = stackFrames[i];
        let fileNameParsed = '<unknown>';
        if (fileName) {
            const subStrLen = fileName.indexOf('?');
            if (subStrLen < 0) {
                fileNameParsed = fileName;
            } else if (subStrLen > 0) {
                fileNameParsed = fileName.substring(0, subStrLen);
            }
        }

        nativeObj.frames.push({
            src: source,
            line: lineNumber || 0,
            col: columnNumber || 0,
            fn: functionName || '<unknown>',
            file: `${fileNameParsed}:${lineNumber || 0}:${columnNumber || 0}`,
        });
    }
    return nativeObj;
}

export const initCrashlytics = (userId, beforeLog = () => ({}), afterLog = () => ({}), forceFatal = false) => {

    RnCrashlytics.setUserID(userId);

    const originalHandler = ErrorUtils.getGlobalHandler();
    async function handler(error, fatal) {
        if (__DEV__) {
            return originalHandler(error, fatal);
        }

        beforeLog();

        if (!isError(error)) {
            await RnCrashlytics.logPromise(`Unknown Error: ${error}`);
            afterLog();
            return originalHandler(error, fatal);
        }

        try {
            const stackFrames = await StackTrace.fromError(error, { offline: true });
            await RnCrashlytics.recordErrorPromise(createNativeErrorObj(error, stackFrames, forceFatal));
            afterLog();
        } catch (_) {
            // do nothing
        }
        return originalHandler(error, fatal);
    }

    ErrorUtils.setGlobalHandler(handler);
    return handler;
};

export default RnCrashlytics;
