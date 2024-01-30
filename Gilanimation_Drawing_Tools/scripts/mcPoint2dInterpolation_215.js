/*
 mcPoint2dInterpolation.js
 Version: 2.15
 Date (DD-MM-YYYY): 04/07/2019

 Description: The MasterController creation script.
              This script can be used after the interpolation grid data is saved to
              a .tbstate file.

 Copyright (C) 2019 Toon Boom Animation Inc.
 https://www.toonboom.com/legal/terms-and-conditions
*/
var stateLib         = require(specialFolders.resource+"/scripts/utilities/state/TB_StateManager.js");
var stateGridUtilLib = require(specialFolders.resource+"/scripts/utilities/ui/interpolationGrid/TB_StateGridHelper.js");
var interpolationCommonLib = require(specialFolders.resource+"/scripts/utilities/ui/TB_InterpolationCommonUtils.js");

function createCameraViewPointWidget()
{
  var posAttr             = node.getAttr(Controller.node, frame.current(), "widget_pos");
  var attr_show_limits    = node.getAttr(Controller.node, frame.current(), "show_limits")
  var attr_label_screen_space = node.getAttr(Controller.node, frame.current(), "label_screen_space");
  var attr_label          = node.getAttr(Controller.node, frame.current(), "label");
  var attr_label_font     = node.getAttr(Controller.node, frame.current(), "label_font");
  var attr_widget_size    = node.getAttr(Controller.node, frame.current(), "widget_size");
  var attr_label_size     = node.getAttr(Controller.node, frame.current(), "label_size");
  var attr_widget_color   = node.getAttr(Controller.node, frame.current(), "widget_color");
  var attr_label_color    = node.getAttr(Controller.node, frame.current(), "label_color");
  var attr_label_bg_color = node.getAttr(Controller.node, frame.current(), "label_bg_color");
  var attr_show_grid_lines = node.getAttr(Controller.node, frame.current(), "show_grid_lines");

  function createDynamicProperties(){
    return { size              : attr_widget_size.doubleValue(),
             show_limits       : attr_show_limits.boolValue(),
             label             : attr_label.textValue(),
             label_color       : attr_label_color.colorValue(),
             label_bg_color    : attr_label_bg_color.colorValue(),
             label_font        : attr_label_font.textValue(),
             label_size        : attr_label_size.doubleValue(),
             label_screenspace : attr_label_screen_space.boolValue(),
             inner_color       : attr_widget_color.colorValue(),
             show_grid_lines   : attr_show_grid_lines.boolValue() };
  }

  var widgetProperties = createDynamicProperties();
  
  var minMaxY = g_stateInterpolator.getURange();
  var minMaxX = g_stateInterpolator.getVRange();
  var initialPos = Point2d((minMaxX[0]+minMaxX[1])/2,
                           (minMaxY[0]+minMaxY[1])/2);

  //Add static properties
  widgetProperties.data = posAttr;
  widgetProperties.xmin = minMaxX[0];
  widgetProperties.ymin = minMaxY[0];
  widgetProperties.xmax = minMaxX[1];
  widgetProperties.ymax = minMaxY[1];
  widgetProperties.yValues = g_stateInterpolator.u_Array;
  widgetProperties.xValues = g_stateInterpolator.v_2dArray[0];
  widgetProperties.point_style     = "Circle";
  widgetProperties.label_pos       = Point2d((minMaxX[0]+minMaxX[1])/2,minMaxY[1]+attr_widget_size.doubleValue()*10.);
  widgetProperties.label_justify   = "Center";
  widgetProperties.selection_color = ColorRGBA(255,255,255);
  widgetProperties.outer_color     = ColorRGBA(0,0,0);
  
  var wid = new Point2dWidget( widgetProperties );
  
  //Capture global variables.
  var stateInterpolatorCapture = g_stateInterpolator;
  
  //Widget value change callback (when the point is moved)
  wid.valueChanged.connect( function(pt2d)
  {
    var u = pt2d.y;
    var v = pt2d.x;
    var interpolatedState = stateInterpolatorCapture.interpolate(u,v);
    interpolatedState.applyState(frame.current());
    Action.performForEach("onActionInvalidateCanvas","cameraView");
  });
  
  //Update dynamic properties when a node change is triggered
  Controller.onNodeChanged = function () {
    wid.updateProperties(createDynamicProperties());
  };

  return wid;
}

function loadInterpolationStates(){
  var uiDataAttr = node.getAttr(Controller.node,frame.current(),"uiData");
  var uiData = JSON.parse(uiDataAttr.textValue());
  
  //example : uiData = {"poses":"/scripts/test1.tbState",
  //                    "location":"scn"}
  function onPreferredLocChanged(newLocation){
    uiData.location = newLocation;
    uiDataAttr.setValue(JSON.stringify(uiData));
  }
  
  function onStateFileLoaded(loadedStates){
    if(loadedStates.length>0)
      g_stateInterpolator = stateGridUtilLib.loadStatesGrid(loadedStates);
  }
  
  interpolationCommonLib.loadMCStateFiles(Controller.node,
                                          stateLib,
                                          [uiData.poses],  //e.g. "/scripts/test1.tbState"
                                          uiData.location, //location key, e.g. "scn"
                                          onPreferredLocChanged,
                                          onStateFileLoaded);
}

//Controller.onFrameChanged = function()
//{
//}

Controller.onShowControl = function()
{
  MessageLog.trace("\n\n\n");
  MessageLog.trace(" ---------------------------------------------------------------------------");
  MessageLog.trace("| " +interpolationCommonLib.mcInterpolationGridFile );
  MessageLog.trace(" ---------------------------------------------------------------------------");
  
  g_stateInterpolator = null;
  loadInterpolationStates();
  
  if(g_stateInterpolator==null)
  {
    MessageLog.trace(translator.tr("Failed to load data."));
    return;
  }
  
  g_widget = createCameraViewPointWidget();
  Controller.controls = [g_widget];
  MessageLog.trace(translator.tr("Done."));
}
