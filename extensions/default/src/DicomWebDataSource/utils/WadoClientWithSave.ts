import { api } from 'dicomweb-client';

function areValidRequestHooks(requestHooks) {
  const isValid =
    Array.isArray(requestHooks) &&
    requestHooks.every(
      requestHook => typeof requestHook === 'function' && requestHook.length === 2
    );

  if (!isValid) {
    console.warn(
      'Request hooks should have the following signature: ' +
        'function requestHook(request, metadata) { return request; }'
    );
  }

  return isValid;
}

function stringToUint8Array(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0, j = str.length; i < j; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function multipartEncode(datasets, boundary = guid(), contentType = 'application/dicom') {
  const contentTypeString = `Content-Type: ${contentType}`;
  const header = `\r\n--${boundary}\r\n${contentTypeString}\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;
  const headerArray = stringToUint8Array(header);
  const footerArray = stringToUint8Array(footer);
  const headerLength = headerArray.length;
  const footerLength = footerArray.length;

  let length = 0;

  // Calculate the total length for the final array
  const contentArrays = datasets.map(datasetBuffer => {
    const contentArray = new Uint8Array(datasetBuffer);
    const contentLength = contentArray.length;

    length += headerLength + contentLength + footerLength;

    return contentArray;
  });

  // Allocate the array
  const multipartArray = new Uint8Array(length);

  // Set the initial header
  multipartArray.set(headerArray, 0);

  // Write each dataset into the multipart array
  let position = 0;
  contentArrays.forEach(contentArray => {
    multipartArray.set(headerArray, position);
    multipartArray.set(contentArray, position + headerLength);

    position += headerLength + contentArray.length;
  });

  multipartArray.set(footerArray, position);

  return {
    data: multipartArray.buffer,
    boundary,
  };
}

class WadoClientWithSave extends api.DICOMwebClient {
  constructor(options) {
    super(options);
    console.log(
      '///////////////////////////////////////////////////////////////////////////////////////'
    );
  }

  httpRequest(url, method, headers = {}, options = {}) {
    const { errorInterceptor, requestHooks } = this;

    return new Promise((resolve, reject) => {
      let request = options.request ? options.request : new XMLHttpRequest();

      request.open(method, url, true);
      if ('responseType' in options) {
        request.responseType = options.responseType;
      }

      if (typeof headers === 'object') {
        Object.keys(headers).forEach(key => {
          request.setRequestHeader(key, headers[key]);
        });
      }

      // now add custom headers from the user
      // (e.g. access tokens)
      const userHeaders = this.headers;
      Object.keys(userHeaders).forEach(key => {
        request.setRequestHeader(key, userHeaders[key]);
      });

      // Event triggered when upload starts
      request.onloadstart = function onloadstart() {
        // console.log('upload started: ', url)
      };

      // Event triggered when upload ends
      request.onloadend = function onloadend() {
        // console.log('upload finished')
      };

      // Handle response message
      request.onreadystatechange = () => {
        if (request.readyState === 4) {
          if (request.status === 200) {
            resolve(request.response);
          } else if (request.status === 202) {
            if (this.verbose) {
              console.warn('some resources already existed: ', request);
            }
            resolve(request.response);
          } else if (request.status === 204) {
            if (this.verbose) {
              console.warn('empty response for request: ', request);
            }
            resolve([]);
          } else {
            const error = new Error('request failed');
            error.request = request;
            error.response = request.response;
            error.status = request.status;
            if (this.verbose) {
              console.error('request failed: ', request);
              console.error(error);
              console.error(error.response);
            }

            errorInterceptor(error);

            reject(error);
          }
        }
      };

      // Event triggered while download progresses
      if ('progressCallback' in options) {
        if (typeof options.progressCallback === 'function') {
          request.onprogress = options.progressCallback;
        }
      }

      if (requestHooks && areValidRequestHooks(requestHooks)) {
        const combinedHeaders = Object.assign({}, headers, this.headers);
        const metadata = { method, url, headers: combinedHeaders };
        const pipeRequestHooks = functions => args =>
          functions.reduce((props, fn) => fn(props, metadata), args);
        const pipedRequest = pipeRequestHooks(requestHooks);
        request = pipedRequest(request);
      }

      // Add withCredentials to request if needed
      if ('withCredentials' in options) {
        if (options.withCredentials) {
          request.withCredentials = true;
        }
      }

      console.log(request);

      if ('data' in options) {
        request.send(options.data);
      } else {
        request.send();
      }
    });
  }

  httpPost(url, headers, data, progressCallback, withCredentials, request) {
    return this.httpRequest(url, 'post', headers, {
      data,
      progressCallback,
      withCredentials,
      request,
    });
  }

  storeInstances(options) {
    if (!('datasets' in options)) {
      throw new Error('datasets are required for storing');
    }

    let url = `${this.stowURL}/studies`;
    if ('studyInstanceUID' in options) {
      url += `/${options.studyInstanceUID}`;
    }
    console.log(url);

    const { data, boundary } = multipartEncode(options.datasets);
    const headers = {
      'Content-Type': `multipart/related; type="application/dicom"; boundary="${boundary}"`,
    };
    const { withCredentials = false } = options;
    console.log(url, headers, data, options.progressCallback, withCredentials, options.request);
    return this.httpPost(
      url,
      headers,
      data,
      options.progressCallback,
      withCredentials,
      options.request
    );
  }

  /**
   * Saves DICOM Instances.
   *
   * @param {Object} options
   * @param {ArrayBuffer[]} options.datasets - DICOM Instances in PS3.10 format
   * @param {String} [options.studyInstanceUID] - Study Instance UID
   * @param {XMLHttpRequest} [options.request] - if specified, the request to use, otherwise one will be created; useful for adding custom upload and abort listeners/objects
   * @returns {Promise} Response message
   */
  save(options) {
    // const url = `${this.stowURL}/instances/2.25.525759748869704514689566522432970368890`;

    // console.log(this.httpPost(url, headers, { Replace: { SeriesDescription: 'world' } }));

    // console.log(
    //   this.httpRequest(`${this.stowURL}/instances`, 'get', {
    //     'Content-Type': `boundary="${'be1695ce-17696cdc-7e3da588-33c81780-48329342/simplified-tags'}"`,
    //   }).then(response => console.log(response))
    // );

    // let url = `${this.stowURL}/instances`;
    // if ('studyInstanceUID' in options) {
    //   url += `/${options.studyInstanceUID}`;
    // }
    // console.log(url);

    // const { data, boundary } = multipartEncode(options.datasets);
    // const headers = {
    //   'Content-Type': `multipart/related; type="application/dicom"; boundary="${boundary}"`,
    // };

    // console.log(data);
    // const { withCredentials = false } = options;

    // return this.httpPost(
    //   url,
    //   headers,
    //   data,
    //   options.progressCallback,
    //   withCredentials,
    //   options.request
    // );

    const url = `http://localhost:80/instances/2.25.525759748869704514689566522432970368890/modify`;
    fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        userId: 1,
        title: 'Fix my bugs',
        completed: false,
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    }).then(responce => console.log(responce));
  }
}

export { WadoClientWithSave };
