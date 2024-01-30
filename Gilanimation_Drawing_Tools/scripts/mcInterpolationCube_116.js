/*
 mcInterpolationCube.js
 Version: 1.16
 Date (DD-MM-YYYY): 04/07/2019

 Description: The MasterController creation script.
              This script can be used after the interpolation cube data is saved to
              a list of .tbstate files.

 Copyright (C) 2019 Toon Boom Animation Inc.
 https://www.toonboom.com/legal/terms-and-conditions
*/
var stateLib         = require(specialFolders.resource+"/scripts/utilities/state/TB_StateManager.js");
var stateGridUtilLib = require(specialFolders.resource+"/scripts/utilities/ui/interpolationGrid/TB_StateGridHelper.js");
var interpolationCommonLib = require(specialFolders.resource+"/scripts/utilities/ui/TB_InterpolationCommonUtils.js");

function current_pos(){
  var posAttr  = node.getAttr(Controller.node, frame.current(), "widget_pos").pos2dValueAt(frame.current());
  return [posAttr.x,posAttr.y];
}

function current_sliderVal(){
  var sliderValAttr  = node.getAttr(Controller.node, frame.current(), "slider_val");
  return sliderValAttr.doubleValueAt(frame.current());
}

function performTrilinearInterpolation(u, v, slider_01, interpolatorsArray){
  var nPoses = interpolatorsArray.length;
  
  //Trilinear interpolation : interpolate layer under (A)
  //                          interpolate layer above (B)
  //                          Then interpolate across A&B (3rd dimension)
  var flt = slider_01*(nPoses-1);
  var ia = Math.floor(flt);
  var ib = Math.ceil(flt);
  var a = (ib-flt);
  var layerAState = interpolatorsArray[ia].interpolate(u,v);
  var layerBstate = interpolatorsArray[ib].interpolate(u,v);
  var finalInterpolation = layerAState.interpolate(1-a,layerBstate);
  
  finalInterpolation.applyState(frame.current());
}

function getUVW(x, y, sliderVal, minMaxX, minMaxY)
{
  if(x<minMaxX[0])
    x = minMaxX[0];
  else if(x>minMaxX[1])
    x = minMaxX[1];
  if(y<minMaxY[0])
    y = minMaxY[0];
  else if(y>minMaxY[1])
    y = minMaxY[1];
  
  var yRange = minMaxY[1]-minMaxY[0];
  var yMin = minMaxY[0];
  
  var u = y;
  var v = x;
  var w = (sliderVal/100);
  
  return [u,v,w];
}

function createPoint2dWidget(interpolatorStack)
{
  var posAttr  = node.getAttr(Controller.node, frame.current(), "widget_pos");
  var attr_show_limits    = node.getAttr(Controller.node, frame.current(), "show_limits");
  var attr_label_screen_space = node.getAttr(Controller.node, frame.current(), "label_screen_space");
  var attr_label          = node.getAttr(Controller.node, frame.current(), "label");
  var attr_label_font     = node.getAttr(Controller.node, frame.current(), "label_font");
  var attr_widget_size    = node.getAttr(Controller.node, frame.current(), "widget_size");
  var attr_label_size     = node.getAttr(Controller.node, frame.current(), "label_size");
  var attr_widget_color   = node.getAttr(Controller.node, frame.current(), "widget_color");
  var attr_label_color    = node.getAttr(Controller.node, frame.current(), "label_color");
  var attr_label_bg_color = node.getAttr(Controller.node, frame.current(), "label_bg_color");
  var attr_show_grid_lines = node.getAttr(Controller.node, frame.current(), "show_grid_lines");

  function createDynamicProperties() {
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

  var minMaxY = interpolatorStack[0].getURange();
  var minMaxX = interpolatorStack[0].getVRange();
  
  //Add static properties
  widgetProperties.data = posAttr;
  widgetProperties.xmin = minMaxX[0];
  widgetProperties.ymin = minMaxY[0];
  widgetProperties.xmax = minMaxX[1];
  widgetProperties.ymax = minMaxY[1];
  widgetProperties.point_style = "Circle"; //("Circle", "Square", "Triangle", "Diamond")
  widgetProperties.label_pos = Point2d((minMaxX[0]+minMaxX[1])/2,minMaxY[1]+attr_widget_size.doubleValue()*10.);
  widgetProperties.label_justify = "Center";
  widgetProperties.yValues = interpolatorStack[0].u_Array;
  widgetProperties.xValues = interpolatorStack[0].v_2dArray[0];
  widgetProperties.selection_color = ColorRGBA(255,255,255);
  widgetProperties.outer_color = ColorRGBA(0, 0, 0);

  var wid = new Point2dWidget(widgetProperties);
  
  //Widget value change callback (when the point is moved)
  wid.valueChanged.connect( function(pt2d)
  {
    var sliderVal = current_sliderVal();
    var uvw = getUVW(pt2d.x,pt2d.y,sliderVal,minMaxX, minMaxY);
    performTrilinearInterpolation(uvw[0],uvw[1],uvw[2],interpolatorStack);
    Action.performForEach("onActionInvalidateCanvas","cameraView");
  });
  
  //Update dynamic properties when a node change is triggered
  Controller.onNodeChanged = function () {
    wid.updateProperties(createDynamicProperties());
  };

  return wid;
}

function createSliderWidget(interpolatorStack)
{
  var sliderAttr = node.getAttr(Controller.node, frame.current(), "slider_val");
  var attr_widget_size = node.getAttr(Controller.node, frame.current(), "widget_size");
  var attr_frame_color = node.getAttr(Controller.node, frame.current(), "frame_color");
  var attr_slider_color = node.getAttr(Controller.node, frame.current(), "slider_color");

  attr_frame_color.setUseSmallEditor(true);
  attr_slider_color.setUseSmallEditor(true);
  //var attr_interpolate_poses = node.getAttr(Controller.node, frame.current(), "interpolate_poses");

  var minMaxY = interpolatorStack[0].getURange();
  var minMaxX = interpolatorStack[0].getVRange();
  var slideLength = 3.;
  var posX = minMaxX[1];
  var posY = 0.;
  
  function createDynamicProperties() {
    var mcSize = attr_widget_size.doubleValue()*7.5;
    return {
      //steps: ((attr_interpolate_poses.boolValue() == true) ? 0 : interpolatorsArray.length), //TODO
      frame_color: attr_frame_color.colorValue(),
      slider_color: attr_slider_color.colorValue(),
      radius: mcSize
    };
  }

  var initParameters = createDynamicProperties();

  //Add static properties
  initParameters.data = sliderAttr;
  initParameters.position = Point2d(posX+0.5,-slideLength/2.);
  initParameters.length = slideLength;
  initParameters.horizontal = false;
  initParameters.slider_selection_color = ColorRGBA(150, 150, 255, 255);
  initParameters.frame_selection_color = ColorRGBA(200, 200, 255, 255);

  var sliderWidget = new SliderWidget(initParameters);
  
  //Widget value change callback (when the slider is moved)
  sliderWidget.valueChanged.connect( function(sliderVal)
  {
    var xy = current_pos();
    var uvw = getUVW(xy[0],xy[1],sliderVal,minMaxX, minMaxY);
    performTrilinearInterpolation(uvw[0],uvw[1],uvw[2],interpolatorStack);
    Action.performForEach("onActionInvalidateCanvas","cameraView");
  });
  
  //Update dynamic properties when a node change is triggered
  var gridUpdateFunc = Controller.onNodeChanged;
  Controller.onNodeChanged = function () {
    gridUpdateFunc();
    sliderWidget.updateProperties(createDynamicProperties());
  };

  return sliderWidget;
}

//This function loads a STACK of interpolation grid data and returns
//an array of 2D interpolators. This is the interpolation cube.
function loadStateGridStack(){
  var uiDataAttr = node.getAttr(Controller.node,frame.current(),"uiData");
  var uiData = JSON.parse(uiDataAttr.textValue());
  
  //example : uiData = {"primary":["/scripts/test1.tbState",
  //                               "/scripts/test2.tbState",
  //                               "/scripts/test3.tbState"],
  //                    "location":"scn"}
  function onPreferredLocChanged(newLocation){
    uiData.location = newLocation;
    uiDataAttr.setValue(JSON.stringify(uiData));
  }
  
  var stateInterpolatorStack = [];
  function onStatesFileLoaded(gridStates){
    var layerInterpolator = stateGridUtilLib.loadStatesGrid(gridStates);
    stateInterpolatorStack.push(layerInterpolator);
  }
  interpolationCommonLib.loadMCStateFiles(Controller.node,
                                          stateLib,
                                          uiData.Primary,
                                          uiData.location,
                                          onPreferredLocChanged,
                                          onStatesFileLoaded);
  
  return stateInterpolatorStack;
}

Controller.onShowControl = function(){
  MessageLog.trace("\n\n\n");
  MessageLog.trace(" ---------------------------------------------------------------------------");
  MessageLog.trace("| " +interpolationCommonLib.mcInterpolationCubeFile );
  MessageLog.trace(" ---------------------------------------------------------------------------");
 
  var primaryInterpolatorStack = loadStateGridStack();
  
  createPoint2dWidget(primaryInterpolatorStack);
  createSliderWidget(primaryInterpolatorStack);
  
  MessageLog.trace("Done.");
}