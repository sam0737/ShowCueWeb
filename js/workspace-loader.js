$(function()
{
  function ignoreDefault(e) {        
    e.preventDefault();  
    e.stopPropagation();
  };
  $('#workspace-drop').on('dragover', ignoreDefault);
  $('#workspace-drop').on('dragenter', ignoreDefault);
  $('#workspace-drop').on('drop', function (e)
  {
    ignoreDefault(e);
    if (
      e.originalEvent.dataTransfer &&
      e.originalEvent.dataTransfer.items.length
      )
    {
      var i = e.originalEvent.dataTransfer.items[0];
      var entry = 
        i.getAsEntry ? i.getAsEntry() :
        i.webkitGetAsEntry ? i.webkitGetAsEntry() :
        null;
      if (entry && entry.getDirectory) {
        initStage(entry);
        return;
      }            
    }
    return;
  });
});
