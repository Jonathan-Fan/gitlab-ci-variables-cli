import axios from 'axios';
import URL from 'url-parse';
import isPrimitive from 'is-primitive';

/**
 * Provides utility functions to simplify interacting with a GitLab CI project through the API
 *
 * @param {string} url
 * @param {string} token
 *
 * @return {object} utility functions wrapped in an object
 */
export default function gitlabCI(url, token) {
  const parsedUrl = new URL(url);

  // Construct project id by encoding namespace/projectName
  const projectId = parsedUrl.pathname
    .split('/')
    .filter(x => x)
    .join('%2F');

  const apiUrl = `${parsedUrl.origin}/api/v4/projects/${projectId}/variables`;
  const tokenQueryString = `private_token=${token}`;

  /**
   * Will serialise a value using `JSON.stringify` if it is not primative.
   *
   * @param {any} value
   * @return {string|number|boolean}
   */
  function serialiseValue(value) {
    if (!isPrimitive(value)) {
      return JSON.stringify(value);
    }

    return value;
  }

  /**
   * Create project variable
   *
   * @param key
   * @param value
   *
   * @return {Promise<Object>} variable object
   */
  async function createVariable(key, value) {
    const response = await axios({
      method: 'post',
      url: `${apiUrl}?${tokenQueryString}`,
      data: {
        key,
        value: serialiseValue(value),
      },
    });

    console.log(`Created new variable ${key} = ${JSON.stringify(value)}`);

    return response.data;
  }

  /**
   * Update project variable
   *
   * @param key
   * @param value
   *
   * @return {Promise<Object>} variable object
   */
  async function updateVariable(key, value) {
    const response = await axios({
      method: 'put',
      url: `${apiUrl}/${key}?${tokenQueryString}`,
      data: {
        key,
        value: serialiseValue(value),
      },
    });

    console.log(`Updated variable ${key} = ${JSON.stringify(value)}`);

    return response.data;
  }

  /**
   * Get all variables for project
   *
   * @return {Promise<Array>} array of variable objects
   */
  async function listVariables() {
    let allVariables = [];
    let response = await axios.head(`${apiUrl}?${tokenQueryString}`);
    const pages = Array.from({ length: response.headers[('x-total-pages')] }, (v, i) => i + 1);

    const promises = pages.map(async (page) => {
      response = await axios.get(`${apiUrl}?${tokenQueryString}&page=${page}`);
      allVariables = allVariables.concat(response.data);
    });

    await Promise.all(promises);

    return allVariables;
  }

  /**
   * Set project variables
   *
   * @param {Object} properties
   * @param forceUpdate if true, override existing values, otherwise ignore them
   *
   * @return {Promise<Array>} array of variable objects
   */
  async function setVariables(properties, forceUpdate) {
    if (!properties) {
      return null;
    }

    const existingKeys = (await listVariables()).map(variable => variable.key);
    const keysToSet = Object.keys(properties);

    const promises = keysToSet.map(async (key) => {
      const value = properties[key];
      const keyExists = existingKeys.includes(key);

      if (keyExists && !forceUpdate) {
        console.log(`Skipped variable ${key}, already set for project.`);
        return undefined;
      }

      let variable;
      if (keyExists) {
        // Update variable
        variable = await updateVariable(key, value);
      } else {
        // Create variable
        variable = await createVariable(key, value);
      }

      return variable;
    });

    const variables = await Promise.all(promises);

    return variables.filter(variable => variable);
  }

  return {
    createVariable,
    updateVariable,
    listVariables,
    setVariables,
  };
}
