const brushInstanceNames = {
  CircularBrush: 'CircularBrush',
  CircularEraser: 'CircularEraser',
  SphereBrush: 'SphereBrush',
  SphereEraser: 'SphereEraser',
  ThresholdCircularBrush: 'ThresholdCircularBrush',
  ThresholdSphereBrush: 'ThresholdSphereBrush',
  SmartBrush: 'SmartBrush',
};

const brushStrategies = {
  CircularBrush: 'FILL_INSIDE_CIRCLE',
  CircularEraser: 'ERASE_INSIDE_CIRCLE',
  SphereBrush: 'FILL_INSIDE_SPHERE',
  SphereEraser: 'ERASE_INSIDE_SPHERE',
  ThresholdCircularBrush: 'THRESHOLD_INSIDE_CIRCLE',
  ThresholdSphereBrush: 'THRESHOLD_INSIDE_SPHERE',
  SmartBrush: 'SMART_BRUSH',
};

function createTools(utilityModule) {
  const { toolNames, Enums } = utilityModule.exports;
  return {
    active: [
      { toolName: toolNames.WindowLevel, bindings: [{ mouseButton: Enums.MouseBindings.Primary }] },
      { toolName: toolNames.Pan, bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }] },
      { toolName: toolNames.Zoom, bindings: [{ mouseButton: Enums.MouseBindings.Secondary }] },
      { toolName: toolNames.StackScrollMouseWheel, bindings: [] },
    ],
    passive: Object.keys(brushInstanceNames)
      .map(brushName => ({
        toolName: brushName,
        parentTool: 'Brush',
        configuration: {
          activeStrategy: brushStrategies[brushName],
        },
      }))
      .concat([
        { toolName: toolNames.Length },
        {
          toolName: toolNames.ArrowAnnotate,
          configuration: {
            getTextCallback: (callback, eventDetails) =>
              commandsManager.runCommand('arrowTextCallback', {
                callback,
                eventDetails,
              }),

            changeTextCallback: (data, eventDetails, callback) =>
              commandsManager.runCommand('arrowTextCallback', {
                callback,
                data,
                eventDetails,
              }),
          },
        },
        { toolName: toolNames.Bidirectional },
        { toolName: toolNames.DragProbe },
        { toolName: toolNames.EllipticalROI },
        { toolName: toolNames.CircleROI },
        { toolName: toolNames.RectangleROI },
        { toolName: toolNames.Angle },
        { toolName: toolNames.CobbAngle },
        { toolName: toolNames.PlanarFreehandROI },
        { toolName: toolNames.CalibrationLine },
        { toolName: toolNames.CircleScissors },
        { toolName: toolNames.RectangleScissors },
        { toolName: toolNames.SphereScissors },
        { toolName: toolNames.StackScroll },
        { toolName: toolNames.Magnify },
        { toolName: toolNames.SegmentationDisplay },
        { toolName: toolNames.SmartBrush },
      ]),
    enabled: [{ toolName: toolNames.ImageOverlayViewer }],
    disabled: [{ toolName: toolNames.ReferenceLines }],
  };
}

function initDefaultToolGroup(extensionManager, toolGroupService, commandsManager, toolGroupId) {
  const utilityModule = extensionManager.getModuleEntry(
    '@ohif/extension-cornerstone.utilityModule.tools'
  );
  const tools = createTools(utilityModule);
  toolGroupService.createToolGroupAndAddTools(toolGroupId, tools);
}

function initMPRToolGroup(extensionManager, toolGroupService, commandsManager) {
  const utilityModule = extensionManager.getModuleEntry(
    '@ohif/extension-cornerstone.utilityModule.tools'
  );
  const tools = createTools(utilityModule);
  tools.disabled.push(
    {
      toolName: utilityModule.exports.toolNames.Crosshairs,
      configuration: {
        viewportIndicators: false,
        autoPan: {
          enabled: false,
          panSize: 10,
        },
      },
    },
    { toolName: utilityModule.exports.toolNames.ReferenceLines }
  );
  toolGroupService.createToolGroupAndAddTools('mpr', tools);
}

function initToolGroups(extensionManager, toolGroupService, commandsManager) {
  initDefaultToolGroup(extensionManager, toolGroupService, commandsManager, 'default');
  initMPRToolGroup(extensionManager, toolGroupService, commandsManager);
}

export default initToolGroups;
