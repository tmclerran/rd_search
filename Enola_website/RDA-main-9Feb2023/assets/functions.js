//returns an array of the text of all elements of class myClass with a parent object $parent
function getArrayFromElementText(myClass, $parent) {
    let arr = []
    $parent.find('.' + myClass).each(function (i, obj) {
        arr.push($(obj).text())
    })
    return arr
}